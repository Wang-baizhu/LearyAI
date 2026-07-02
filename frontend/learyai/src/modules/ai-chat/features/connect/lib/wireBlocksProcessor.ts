// wireBlocksProcessor 负责将 wire blocks 解析为前端消息事件，并维护流式缓冲。
import type { ChatMessage, ChatSender, ContentBlock, PermissionRequest } from '../../../entities';
import type { NormalizedEvent } from '../../../entities';
import type { WireBlocksInput, WireBlock } from '../model/types';
import type {
  AgentWireBtwBeginPayload,
  AgentWireBtwEndPayload,
  AgentWireContentPart,
  AgentWireHookTriggeredPayload,
  AgentWirePlanDisplayPayload,
} from '../../../shared/api';
import { createTraceId } from '@/shared/lib/traceId';
import { mergeMessageBlocks } from '../../../entities';

type WireContentPart = AgentWireContentPart;

type WireToolCall = {
  id: string;
  function?: { name?: string | null; arguments?: string | null };
};

type WireToolResult = {
  tool_call_id: string;
  return_value?: {
    is_error?: boolean;
    output?: unknown;
    message?: string | null;
  };
};

type WireApprovalRequest = {
  id: string;
  tool_call_id: string;
  sender?: string | null;
  action?: string | null;
  description?: string | null;
  display?: unknown[];
  options?: string[];
};

type WirePlanDisplay = AgentWirePlanDisplayPayload;

type WireNotification = {
  id?: string | null;
  title?: string | null;
  body?: string | null;
  severity?: string | null;
  category?: string | null;
};

type WireBtwBeginPayload = AgentWireBtwBeginPayload;
type WireBtwEndPayload = AgentWireBtwEndPayload;
type WireHookTriggeredPayload = AgentWireHookTriggeredPayload;
type WireStatusPayload = {
  event?: string | null;
  target?: string | null;
  action?: string | null;
  reason?: string | null;
};

type ActiveTextType = 'text' | 'thinking' | null;

type SessionBuffer = {
  activeTextType: ActiveTextType;
  activeText: string;
  pendingBlocks: ContentBlock[];
  currentToolCallId: string | null;
  toolCallArgs: Map<string, string>;
  toolCallTitles: Map<string, string>;
  subagentToolCallIds: Set<string>;
  completedSubagentToolCallIds: Set<string>;
  subagentInfo: Map<string, TaskToolInfo>;
  subagentTextByKey: Map<string, { activeTextType: ActiveTextType; text: string }>;
};

type TaskToolInfo = {
  name?: string;
  description?: string;
  hasBeginEmitted?: boolean;
  hasEndEmitted?: boolean;
};

const DEFAULT_APPROVAL_OPTIONS = ['approve', 'approve_for_session', 'reject'];

const createSessionBuffer = (): SessionBuffer => ({
  activeTextType: null,
  activeText: '',
  pendingBlocks: [],
  currentToolCallId: null,
  toolCallArgs: new Map(),
  toolCallTitles: new Map(),
  subagentToolCallIds: new Set(),
  completedSubagentToolCallIds: new Set(),
  subagentInfo: new Map(),
  subagentTextByKey: new Map(),
});

const normalizeWireBlocksInput = (input: WireBlocksInput | undefined | null): WireBlock[] => {
  if (!input) return [];
  if (Array.isArray(input)) {
    if (input.length === 0) return [];
    if (Array.isArray(input[0])) {
      return (input as WireBlock[][]).flat();
    }
    return input as WireBlock[];
  }
  return [input as WireBlock];
};

const extractUserText = (input: unknown): string => {
  if (typeof input === 'string') return input;
  if (Array.isArray(input)) {
    return input
      .map((part) => {
        const payload = part as WireContentPart;
        if (payload?.type === 'text' && typeof payload.text === 'string') return payload.text;
        if (payload?.type === 'think' && typeof payload.think === 'string') return payload.think;
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return '';
};

const extractTurnInputText = (payload: { user_input?: unknown; user_input_text?: unknown; user_input_parts?: unknown }) =>
  extractUserText(payload.user_input ?? payload.user_input_parts ?? payload.user_input_text);

const extractToolResultText = (output: unknown): string => {
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) {
    return output
      .map((part) => {
        const payload = part as WireContentPart;
        if (payload?.type === 'text' && typeof payload.text === 'string') return payload.text;
        if (payload?.type === 'think' && typeof payload.think === 'string') return payload.think;
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  if (output && typeof output === 'object') {
    try {
      return JSON.stringify(output, null, 2);
    } catch {
      return '';
    }
  }
  return '';
};

const flushActiveText = (buffer: SessionBuffer) => {
  if (!buffer.activeTextType || !buffer.activeText) return;
  buffer.pendingBlocks.push({
    type: buffer.activeTextType,
    text: buffer.activeText,
  } as ContentBlock);
  buffer.activeText = '';
  buffer.activeTextType = null;
};

const resetTurnState = (buffer: SessionBuffer) => {
  buffer.activeTextType = null;
  buffer.activeText = '';
  buffer.pendingBlocks = [];
  buffer.currentToolCallId = null;
  buffer.toolCallArgs.clear();
  buffer.toolCallTitles.clear();
  buffer.subagentToolCallIds.clear();
  buffer.completedSubagentToolCallIds.clear();
  buffer.subagentInfo.clear();
  buffer.subagentTextByKey.clear();
};

type WireBlocksSink = {
  emitUserMessage: (text: string) => void;
  emitAssistantBlocks: (blocks: ContentBlock[]) => void;
  emitPermissionRequest: (request: PermissionRequest) => void;
  emitAssistantBoundary: () => void;
};

type WireSubagentEvent = {
  parent_tool_call_id?: string;
  agent_id?: string;
  subagent_type?: string;
  event?: {
    type?: string;
    payload?: Record<string, unknown>;
  };
};

const parseTaskArgs = (rawArgs: string | null | undefined) => {
  if (!rawArgs) return null;
  try {
    const parsed = JSON.parse(rawArgs) as {
      subagent_type?: unknown;
      description?: unknown;
    };
    return {
      name: typeof parsed.subagent_type === 'string' ? parsed.subagent_type : undefined,
      description: typeof parsed.description === 'string' ? parsed.description : undefined,
    };
  } catch {
    return null;
  }
};

const isSubagentToolName = (toolName?: string | null) => toolName === 'Agent';

const resolveSubagentKey = (payload: WireSubagentEvent | null | undefined) =>
  payload?.parent_tool_call_id?.trim() || null;

const ensureTaskInfo = (buffer: SessionBuffer, toolCallId: string) => {
  const existing = buffer.subagentInfo.get(toolCallId);
  if (existing) return existing;
  const fresh: TaskToolInfo = {
    name: undefined,
    description: undefined,
    hasBeginEmitted: false,
    hasEndEmitted: false,
  };
  buffer.subagentInfo.set(toolCallId, fresh);
  return fresh;
};

const getSubagentName = (buffer: SessionBuffer, toolCallId?: string | null) => {
  if (!toolCallId) return 'subagent';
  return buffer.subagentInfo.get(toolCallId)?.name ?? 'subagent';
};

const flushSubagentText = (
  buffer: SessionBuffer,
  taskToolCallId: string,
  subagentName: string
) => {
  const current = buffer.subagentTextByKey.get(taskToolCallId);
  if (!current?.activeTextType || !current.text) return;
  buffer.pendingBlocks.push({
    type: 'subagent',
    name: subagentName,
    status: 'update',
    text: current.text,
    taskToolCallId,
  });
  current.activeTextType = null;
  current.text = '';
};

const pushStatusBlock = (
  buffer: SessionBuffer,
  title: string,
  description?: string,
  tone: 'info' | 'success' | 'warning' | 'error' = 'info'
) => {
  flushActiveText(buffer);
  buffer.pendingBlocks.push({
    type: 'status',
    title,
    description,
    tone,
  });
};

const consumeWireBlocks = (
  blocks: WireBlock[],
  buffer: SessionBuffer,
  sink: WireBlocksSink
) => {
  const enqueueTaskBegin = (toolCallId: string) => {
    const info = buffer.subagentInfo.get(toolCallId);
    if (!info?.name || info.hasBeginEmitted) return;
    buffer.pendingBlocks.push({
      type: 'subagent',
      name: info.name,
      status: 'begin',
      text: info.description,
      taskToolCallId: toolCallId,
    });
    info.hasBeginEmitted = true;
  };

  const enqueueTaskEnd = (toolCallId: string) => {
    if (buffer.completedSubagentToolCallIds.has(toolCallId)) return;
    const info = buffer.subagentInfo.get(toolCallId);
    if (!info?.name || info.hasEndEmitted) return;
    if (!info.hasBeginEmitted) {
      enqueueTaskBegin(toolCallId);
    }
    buffer.pendingBlocks.push({
      type: 'subagent',
      name: info.name,
      status: 'end',
      text: info.description,
      taskToolCallId: toolCallId,
    });
    info.hasEndEmitted = true;
    buffer.completedSubagentToolCallIds.add(toolCallId);
  };

  blocks.forEach((block) => {
    switch (block.type) {
      case 'TurnBegin': {
        if (buffer.pendingBlocks.length > 0 || buffer.activeText) {
          flushActiveText(buffer);
          if (buffer.pendingBlocks.length > 0) {
            sink.emitAssistantBlocks(buffer.pendingBlocks);
            buffer.pendingBlocks = [];
          }
        }
        resetTurnState(buffer);
        const userText = extractTurnInputText(
          (block.payload as {
            user_input?: unknown;
            user_input_text?: unknown;
            user_input_parts?: unknown;
          }) ?? {}
        );
        if (userText) {
          sink.emitUserMessage(userText);
        }
        break;
      }
      case 'SteerInput': {
        if (buffer.pendingBlocks.length > 0 || buffer.activeText) {
          flushActiveText(buffer);
          if (buffer.pendingBlocks.length > 0) {
            sink.emitAssistantBlocks(buffer.pendingBlocks);
            buffer.pendingBlocks = [];
          }
        }
        const userText = extractTurnInputText(
          (block.payload as {
            user_input?: unknown;
            user_input_text?: unknown;
            user_input_parts?: unknown;
          }) ?? {}
        );
        if (userText) {
          sink.emitUserMessage(userText);
        }
        break;
      }
      case 'StepBegin': {
        flushActiveText(buffer);
        if (buffer.pendingBlocks.length > 0) {
          sink.emitAssistantBlocks(buffer.pendingBlocks);
          buffer.pendingBlocks = [];
        }
        sink.emitAssistantBoundary();
        break;
      }
      case 'ContentPart': {
        const payload = block.payload as unknown as WireContentPart;
        if (payload?.type === 'think' && payload.think) {
          if (buffer.activeTextType && buffer.activeTextType !== 'thinking') {
            flushActiveText(buffer);
          }
          buffer.activeTextType = 'thinking';
          buffer.activeText += payload.think;
        }
        if (payload?.type === 'text' && payload.text) {
          if (buffer.activeTextType && buffer.activeTextType !== 'text') {
            flushActiveText(buffer);
          }
          buffer.activeTextType = 'text';
          buffer.activeText += payload.text;
        }
        break;
      }
      case 'TextPart': {
        const payload = block.payload as unknown as WireContentPart;
        if (payload?.text) {
          if (buffer.activeTextType && buffer.activeTextType !== 'text') {
            flushActiveText(buffer);
          }
          buffer.activeTextType = 'text';
          buffer.activeText += payload.text;
        }
        break;
      }
      case 'ThinkPart': {
        const payload = block.payload as unknown as WireContentPart;
        if (payload?.think) {
          if (buffer.activeTextType && buffer.activeTextType !== 'thinking') {
            flushActiveText(buffer);
          }
          buffer.activeTextType = 'thinking';
          buffer.activeText += payload.think;
        }
        break;
      }
      case 'ToolCall': {
        flushActiveText(buffer);
        const payload = block.payload as WireToolCall;
        const toolCallId = payload?.id;
        if (!toolCallId) break;
        const title = payload.function?.name ?? 'Tool Call';
        const args = payload.function?.arguments ?? '';
        buffer.currentToolCallId = toolCallId;
        buffer.toolCallArgs.set(toolCallId, args ?? '');
        buffer.toolCallTitles.set(toolCallId, title);
        if (isSubagentToolName(title)) {
          buffer.subagentToolCallIds.add(toolCallId);
          const parsed = parseTaskArgs(args);
          if (parsed) {
            const info = ensureTaskInfo(buffer, toolCallId);
            if (parsed.name) info.name = parsed.name;
            if (parsed.description) info.description = parsed.description;
            enqueueTaskBegin(toolCallId);
          }
          break;
        }
        buffer.pendingBlocks.push({
          type: 'tool_call',
          toolCallId,
          title,
          status: 'in_progress',
          args: args || undefined,
        });
        break;
      }
      case 'ToolCallPart': {
        const payload = block.payload as { arguments_part?: string | null };
        const toolCallId = buffer.currentToolCallId;
        if (!toolCallId || !payload?.arguments_part) break;
        const currentArgs = buffer.toolCallArgs.get(toolCallId) ?? '';
        const nextArgs = `${currentArgs}${payload.arguments_part}`;
        buffer.toolCallArgs.set(toolCallId, nextArgs);
        const toolTitle = buffer.toolCallTitles.get(toolCallId);
        if (isSubagentToolName(toolTitle)) {
          const parsed = parseTaskArgs(nextArgs);
          if (parsed) {
            const info = ensureTaskInfo(buffer, toolCallId);
            if (parsed.name) info.name = parsed.name;
            if (parsed.description) info.description = parsed.description;
            enqueueTaskBegin(toolCallId);
          }
          break;
        }
        const pendingIndex = buffer.pendingBlocks.findIndex(
          (item) => item.type === 'tool_call' && item.toolCallId === toolCallId
        );
        if (pendingIndex >= 0) {
          const pending = buffer.pendingBlocks[pendingIndex] as Extract<
            ContentBlock,
            { type: 'tool_call' }
          >;
          buffer.pendingBlocks[pendingIndex] = {
            ...pending,
            args: nextArgs,
          };
        } else {
          sink.emitAssistantBlocks([
            {
              type: 'tool_call',
              toolCallId,
              title: buffer.toolCallTitles.get(toolCallId) ?? 'Tool Call',
              status: 'in_progress',
              args: nextArgs,
            },
          ]);
        }
        break;
      }
      case 'ToolResult': {
        flushActiveText(buffer);
        const payload = block.payload as WireToolResult;
        const toolCallId = payload?.tool_call_id;
        if (!toolCallId) break;
        if (buffer.subagentToolCallIds.has(toolCallId)) {
          if (buffer.completedSubagentToolCallIds.has(toolCallId)) break;
          flushSubagentText(buffer, toolCallId, getSubagentName(buffer, toolCallId));
          enqueueTaskEnd(toolCallId);
          buffer.pendingBlocks.push({
            type: 'tool_result',
            toolCallId,
            result: extractToolResultText(payload.return_value?.output),
            status: payload.return_value?.is_error ? 'failed' : 'succeeded',
            taskToolCallId: toolCallId,
          });
          break;
        }
        const outputText = extractToolResultText(payload.return_value?.output);
        const status = payload.return_value?.is_error ? 'failed' : 'succeeded';
        buffer.pendingBlocks.push({
          type: 'tool_result',
          toolCallId,
          result: outputText,
          status,
        });
        break;
      }
      case 'ApprovalRequest': {
        flushActiveText(buffer);
        const payload = block.payload as WireApprovalRequest;
        if (!payload?.tool_call_id) break;
        sink.emitPermissionRequest({
          requestId: payload.id ?? payload.tool_call_id,
          toolCallId: payload.tool_call_id,
          title: payload.action ?? payload.sender ?? '权限请求',
          description: payload.description ?? '',
          options: payload.options ?? DEFAULT_APPROVAL_OPTIONS,
          timeout: 0,
        });
        break;
      }
      case 'SubagentEvent': {
        const payload = block.payload as WireSubagentEvent;
        const taskToolCallId = resolveSubagentKey(payload);
        const event = payload?.event;
        if (!taskToolCallId || !event?.type) break;
        const info = ensureTaskInfo(buffer, taskToolCallId);
        const subagentName =
          payload?.subagent_type?.trim() || info.name || getSubagentName(buffer, taskToolCallId);
        if (subagentName && !info.name) {
          info.name = subagentName;
        }
        if (event.type !== 'ContentPart' && event.type !== 'TextPart' && event.type !== 'ThinkPart') {
          flushSubagentText(buffer, taskToolCallId, subagentName);
        }
        if (event.type === 'TurnBegin') {
          enqueueTaskBegin(taskToolCallId);
          break;
        }
        if (event.type === 'TurnEnd' || event.type === 'StepInterrupted') {
          enqueueTaskEnd(taskToolCallId);
          break;
        }
        if (event.type === 'ContentPart' || event.type === 'TextPart' || event.type === 'ThinkPart') {
          const contentPayload = event.payload as unknown as WireContentPart;
          const current = buffer.subagentTextByKey.get(taskToolCallId) ?? {
            activeTextType: null,
            text: '',
          };
          const nextType =
            event.type === 'ThinkPart' || contentPayload?.type === 'think' ? 'thinking' : 'text';
          const nextText =
            nextType === 'thinking' ? contentPayload?.think ?? '' : contentPayload?.text ?? '';
          if (!nextText) break;
          if (current.activeTextType && current.activeTextType !== nextType) {
            flushSubagentText(buffer, taskToolCallId, subagentName);
            current.activeTextType = null;
            current.text = '';
          }
          current.activeTextType = nextType;
          current.text += nextText;
          buffer.subagentTextByKey.set(taskToolCallId, current);
          break;
        }
        if (event.type === 'ToolCall') {
          const toolPayload = event.payload as WireToolCall;
          const toolCallId = toolPayload?.id;
          if (!toolCallId) break;
          buffer.pendingBlocks.push({
            type: 'tool_call',
            toolCallId,
            title: toolPayload.function?.name ?? 'Tool Call',
            status: 'in_progress',
            args: toolPayload.function?.arguments ?? undefined,
            subagentName,
            taskToolCallId,
          });
          break;
        }
        if (event.type === 'ToolCallPart') {
          const toolPayload = event.payload as { tool_call_id?: string | null; arguments_part?: string | null };
          const toolCallId = toolPayload?.tool_call_id;
          if (!toolCallId || !toolPayload.arguments_part) break;
          const pendingIndex = buffer.pendingBlocks.findIndex(
            (item) =>
              item.type === 'tool_call' &&
              item.toolCallId === toolCallId &&
              item.taskToolCallId === taskToolCallId
          );
          if (pendingIndex >= 0) {
            const pending = buffer.pendingBlocks[pendingIndex] as Extract<
              ContentBlock,
              { type: 'tool_call' }
            >;
            buffer.pendingBlocks[pendingIndex] = {
              ...pending,
              args: `${pending.args ?? ''}${toolPayload.arguments_part}`,
            };
          }
          break;
        }
        if (event.type === 'ToolResult') {
          const toolPayload = event.payload as WireToolResult;
          const toolCallId = toolPayload?.tool_call_id;
          if (!toolCallId) break;
          buffer.pendingBlocks.push({
            type: 'tool_result',
            toolCallId,
            result: extractToolResultText(toolPayload.return_value?.output),
            status: toolPayload.return_value?.is_error ? 'failed' : 'succeeded',
            taskToolCallId,
          });
          break;
        }
        if (event.type === 'PlanDisplay') {
          const planPayload = event.payload as unknown as WirePlanDisplay;
          buffer.pendingBlocks.push({
            type: 'plan',
            content: planPayload.content ?? '',
            filePath: planPayload.file_path ?? '',
          });
        }
        break;
      }
      case 'PlanDisplay': {
        const payload = block.payload as unknown as WirePlanDisplay;
        flushActiveText(buffer);
        buffer.pendingBlocks.push({
          type: 'plan',
          content: payload.content ?? '',
          filePath: payload.file_path ?? '',
        });
        break;
      }
      case 'Notification': {
        const payload = block.payload as WireNotification;
        flushActiveText(buffer);
        buffer.pendingBlocks.push({
          type: 'notification',
          notificationId: payload.id ?? '',
          title: payload.title ?? '通知',
          body: payload.body ?? '',
          severity:
            payload.severity === 'warning' || payload.severity === 'error' ? payload.severity : 'info',
          category: payload.category ?? undefined,
        });
        break;
      }
      case 'BtwBegin': {
        const payload = block.payload as unknown as WireBtwBeginPayload;
        pushStatusBlock(buffer, '侧问处理中', payload.question ?? undefined, 'info');
        break;
      }
      case 'BtwEnd': {
        const payload = block.payload as unknown as WireBtwEndPayload;
        pushStatusBlock(
          buffer,
          payload.error ? '侧问失败' : '侧问完成',
          payload.error ?? payload.response ?? undefined,
          payload.error ? 'error' : 'success'
        );
        break;
      }
      case 'HookTriggered': {
        const payload = block.payload as unknown as WireHookTriggeredPayload;
        pushStatusBlock(
          buffer,
          `Hook 已触发：${payload.event ?? 'unknown'}`,
          payload.target ?? undefined,
          'info'
        );
        break;
      }
      case 'HookResolved': {
        const payload = block.payload as WireStatusPayload;
        pushStatusBlock(
          buffer,
          `Hook 已完成：${payload.event ?? 'unknown'}`,
          payload.reason ?? payload.target ?? undefined,
          payload.action === 'block' ? 'warning' : 'success'
        );
        break;
      }
      case 'MCPLoadingBegin': {
        pushStatusBlock(buffer, 'MCP 工具加载中', undefined, 'info');
        break;
      }
      case 'MCPLoadingEnd': {
        pushStatusBlock(buffer, 'MCP 工具加载完成', undefined, 'success');
        break;
      }
      case 'CompactionBegin': {
        pushStatusBlock(buffer, '上下文压缩中', undefined, 'info');
        break;
      }
      case 'CompactionEnd': {
        pushStatusBlock(buffer, '上下文压缩完成', undefined, 'success');
        break;
      }
      default:
        break;
    }
  });
};

export const createAiChatWireEventProcessor = () => {
  const buffers = new Map<string, SessionBuffer>();

  const getBuffer = (agentSessionId: string) => {
    const existing = buffers.get(agentSessionId);
    if (existing) return existing;
    const fresh = createSessionBuffer();
    buffers.set(agentSessionId, fresh);
    return fresh;
  };

  const resetSession = (agentSessionId: string) => {
    buffers.delete(agentSessionId);
  };

  const resetTurn = (agentSessionId: string) => {
    const buffer = buffers.get(agentSessionId);
    if (!buffer) return;
    resetTurnState(buffer);
  };

  const processContext = (
    agentSessionId: string,
    blocksInput: WireBlocksInput | undefined | null,
    isStreaming?: boolean,
    prepend = false
  ): NormalizedEvent[] => {
    if (!prepend) {
      resetSession(agentSessionId);
    }
    const buffer = prepend ? createSessionBuffer() : createSessionBuffer();
    if (!prepend) {
      buffers.set(agentSessionId, buffer);
    }
    const messages: ChatMessage[] = [];
    let currentAssistantIndex: number | null = null;
    const events: NormalizedEvent[] = [];

    const sink: WireBlocksSink = {
      emitUserMessage: (text: string) => {
        const localId = `user-${createTraceId()}`;
        messages.push({
          id: localId,
          sender: 'user',
          blocks: text ? [{ type: 'text', text }] : [],
        });
        currentAssistantIndex = null;
      },
      emitAssistantBlocks: (blocks: ContentBlock[]) => {
        if (currentAssistantIndex === null) {
          messages.push({
            id: `assistant-${createTraceId()}`,
            sender: 'assistant',
            blocks: [],
          });
          currentAssistantIndex = messages.length - 1;
        }
        const current = messages[currentAssistantIndex];
        messages[currentAssistantIndex] = {
          ...current,
          blocks: mergeMessageBlocks(current.blocks, blocks),
        };
      },
      emitPermissionRequest: () => {},
      emitAssistantBoundary: () => {
        currentAssistantIndex = null;
      },
    };

    const blocks = normalizeWireBlocksInput(blocksInput);
    consumeWireBlocks(blocks, buffer, sink);
    flushActiveText(buffer);
    buffer.subagentTextByKey.forEach((_, taskToolCallId) => {
      flushSubagentText(buffer, taskToolCallId, getSubagentName(buffer, taskToolCallId));
    });
    if (buffer.pendingBlocks.length > 0) {
      sink.emitAssistantBlocks(buffer.pendingBlocks);
      if (!prepend) {
        // processContext 会把当前缓冲整体落成 messages.reset，因此这里必须立即清空；
        // 否则下一批 messages:updated 进入 processUpdate 时，会把 context 首包已经发出的内容再带出来一次。
        buffer.pendingBlocks = [];
      }
    }
    if (!prepend && isStreaming === true) {
      events.push({
        type: 'session.status',
        agentSessionId,
        status: { exists: true, isStreaming: true },
      });
    }
    if (!prepend && isStreaming === false) {
      events.push({
        type: 'session.status',
        agentSessionId,
        status: { exists: true, isStreaming: false },
      });
    }
    events.push(
      {
        type: prepend ? 'messages.prepend' : 'messages.reset',
        agentSessionId,
        messages,
      },
    );
    if (!prepend) {
      events.push({
        type: 'session.needContext',
        agentSessionId,
        needContext: false,
      });
    }

    return events;
  };

  const processUpdate = (
    agentSessionId: string,
    blocksInput: WireBlocksInput | undefined | null
  ): NormalizedEvent[] => {
    const buffer = getBuffer(agentSessionId);
    const events: NormalizedEvent[] = [];

    const sink: WireBlocksSink = {
      emitUserMessage: (text: string) => {
        events.push({
          type: 'message.blocks',
          agentSessionId,
          blocks: text ? [{ type: 'text', text }] : [],
          sender: 'user',
        });
      },
      emitAssistantBlocks: (blocks: ContentBlock[]) => {
        events.push({
          type: 'message.blocks',
          agentSessionId,
          blocks,
          sender: 'assistant' as ChatSender,
        });
      },
      emitPermissionRequest: (request: PermissionRequest) => {
        events.push({
          type: 'permission.request',
          agentSessionId,
          request,
        });
      },
      emitAssistantBoundary: () => {
        events.push({
          type: 'assistant.messageBoundary',
          agentSessionId,
        });
      },
    };

    const blocks = normalizeWireBlocksInput(blocksInput);
    consumeWireBlocks(blocks, buffer, sink);
    flushActiveText(buffer);
    buffer.subagentTextByKey.forEach((_, taskToolCallId) => {
      flushSubagentText(buffer, taskToolCallId, getSubagentName(buffer, taskToolCallId));
    });
    if (buffer.pendingBlocks.length > 0) {
      sink.emitAssistantBlocks(buffer.pendingBlocks);
      buffer.pendingBlocks = [];
    }

    return events;
  };

  return {
    processContext,
    processUpdate,
    resetSession,
    resetTurn,
  };
};
