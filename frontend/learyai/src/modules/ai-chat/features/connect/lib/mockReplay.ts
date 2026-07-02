// mockReplay 负责 AI Chat mock 回放数据结构、收集与调试输出格式化。
import { createTraceId } from '@/shared/lib/traceId';
import mockReplayJson from './mock.json';
import type { AgentWsEvent } from '../../../shared/api/agentWs';
import type {
  MessagesUpdatedPayload,
  QueryStatePayload,
  SessionContextPayload,
  SessionCreatedPayload,
} from '../model/types';

export type AiChatMockReplayEvent =
  | {
      cmd: 'session:context';
      payload: Omit<SessionContextPayload, 'agentSessionId'>;
      meta?: { agentSessionId?: string; subagentId?: string };
    }
  | {
      cmd: 'messages:updated' | 'message:update';
      payload: MessagesUpdatedPayload;
      meta?: { agentSessionId?: string; subagentId?: string };
    }
  | {
      cmd: 'session:created';
      payload: SessionCreatedPayload;
      meta?: { agentSessionId?: string; subagentId?: string };
    }
  | {
      cmd: 'query:state';
      payload: QueryStatePayload;
      meta?: { agentSessionId?: string; subagentId?: string };
    }
  | {
      cmd: 'agent.result' | 'agent.cancelled';
      payload: Record<string, unknown>;
      meta?: { agentSessionId?: string; subagentId?: string };
    };

type LegacyAiChatMockReplayUpdate = {
  cmd: 'messages:updated' | 'message:update';
  payload: MessagesUpdatedPayload;
};

export type LegacyAiChatMockReplayTurn = {
  sessionContext?: Omit<SessionContextPayload, 'agentSessionId'>;
  updates?: LegacyAiChatMockReplayUpdate[];
  finishAction?: 'agent.result' | 'agent.cancelled';
};

export type AiChatMockReplayTurn = {
  events: AiChatMockReplayEvent[];
};

export type AiChatMockReplaySnapshot = {
  hasSessionContext: boolean;
  hasMessageUpdate: boolean;
  turn: AiChatMockReplayTurn;
};

type MutableReplayTurn = {
  events: AiChatMockReplayEvent[];
};

type ReplayTurnInput = AiChatMockReplayTurn | LegacyAiChatMockReplayTurn | MutableReplayTurn;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readSessionId = (payload: unknown, key: 'agentSessionId' | 'parentSessionId') => {
  if (!isRecord(payload)) {
    return null;
  }
  const value = payload[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const isEventsReplayTurn = (
  turn: ReplayTurnInput
): turn is AiChatMockReplayTurn | MutableReplayTurn => 'events' in turn && Array.isArray(turn.events);

const isLegacyReplayTurn = (turn: ReplayTurnInput): turn is LegacyAiChatMockReplayTurn =>
  'sessionContext' in turn || 'updates' in turn;

const isMockReplayJsonValue = (
  value: unknown
): value is AiChatMockReplayTurn | LegacyAiChatMockReplayTurn | null => {
  if (value === null) return true;
  if (!isRecord(value)) return false;
  if ('events' in value) {
    return Array.isArray(value.events);
  }
  if ('sessionContext' in value || 'updates' in value) {
    return true;
  }
  return false;
};

// 将控制台打印出的对象直接粘贴到同目录 mock.json，即可在 VITE_AI_CHAT_MOCK_MODE=1 下回放。
export const AI_CHAT_MOCK_REPLAY_TURN: AiChatMockReplayTurn | LegacyAiChatMockReplayTurn | null =
  isMockReplayJsonValue(mockReplayJson) ? mockReplayJson : null;

const ensureReplayTurn = (
  turnsBySession: Map<string, MutableReplayTurn>,
  agentSessionId: string
) => {
  const existing = turnsBySession.get(agentSessionId);
  if (existing) return existing;
  const created: MutableReplayTurn = {
    events: [],
  };
  turnsBySession.set(agentSessionId, created);
  return created;
};

export const createAiChatMockCollector = () => {
  const turnsBySession = new Map<string, MutableReplayTurn>();

  return {
    collectEvent: (agentSessionId: string, event: AiChatMockReplayEvent) => {
      ensureReplayTurn(turnsBySession, agentSessionId).events.push(event);
    },
    flush: (agentSessionId: string): AiChatMockReplaySnapshot | null => {
      const snapshot = turnsBySession.get(agentSessionId);
      turnsBySession.delete(agentSessionId);
      if (!snapshot || snapshot.events.length === 0) return null;
      const normalized = normalizeAiChatMockReplayTurn(snapshot);
      return {
        hasSessionContext: normalized.events.some((event) => event.cmd === 'session:context'),
        hasMessageUpdate: normalized.events.some(
          (event) => event.cmd === 'messages:updated' || event.cmd === 'message:update'
        ),
        turn: normalized,
      };
    },
    peek: (agentSessionId: string): AiChatMockReplaySnapshot | null => {
      const snapshot = turnsBySession.get(agentSessionId);
      if (!snapshot || snapshot.events.length === 0) return null;
      const normalized = normalizeAiChatMockReplayTurn(snapshot);
      return {
        hasSessionContext: normalized.events.some((event) => event.cmd === 'session:context'),
        hasMessageUpdate: normalized.events.some(
          (event) => event.cmd === 'messages:updated' || event.cmd === 'message:update'
        ),
        turn: normalized,
      };
    },
    reset: (agentSessionId: string) => {
      turnsBySession.delete(agentSessionId);
    },
  };
};

export const normalizeAiChatMockReplayTurn = (turn: ReplayTurnInput): AiChatMockReplayTurn => {
  if (isEventsReplayTurn(turn)) {
    return {
      events: turn.events,
    };
  }

  if (isLegacyReplayTurn(turn)) {
    const events: AiChatMockReplayEvent[] = [];
    if (turn.sessionContext) {
      events.push({
        cmd: 'session:context',
        payload: turn.sessionContext,
      });
    }
    (turn.updates ?? []).forEach((update) => {
      events.push(update);
    });
    return { events };
  }

  return { events: [] };
};

export const formatAiChatMockReplayTurn = (
  turn: AiChatMockReplayTurn | LegacyAiChatMockReplayTurn
) => JSON.stringify(normalizeAiChatMockReplayTurn(turn), null, 2);

const parseAgentToolArguments = (value: unknown) => {
  if (!isRecord(value)) {
    return null;
  }
  const functionValue = value.function;
  if (!isRecord(functionValue) || functionValue.name !== 'Agent') {
    return null;
  }
  const rawArguments = functionValue.arguments;
  if (typeof rawArguments !== 'string') {
    return null;
  }
  try {
    const parsed = JSON.parse(rawArguments);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const buildSyntheticSubagentEvents = (
  turn: AiChatMockReplayTurn,
  rootSessionId: string
): AiChatMockReplayTurn => {
  const nextEvents: AiChatMockReplayEvent[] = [];
  const activeSubagents = new Set<string>();
  const toolCallSummaries = new Map<string, { description?: string; subagentType?: string }>();

  turn.events.forEach((event) => {
    const beforeEvents: AiChatMockReplayEvent[] = [];
    const afterEvents: AiChatMockReplayEvent[] = [];
    if (event.cmd === 'messages:updated' || event.cmd === 'message:update') {
      const blocks = Array.isArray(event.payload.blocks) ? event.payload.blocks : [];
      blocks.forEach((block) => {
        if (!isRecord(block)) {
          return;
        }
        if (block.type === 'ToolCall' && isRecord(block.payload)) {
          const payload = block.payload;
          const parsedArguments = parseAgentToolArguments(payload);
          const toolCallId = typeof payload.id === 'string' ? payload.id : undefined;
          if (!toolCallId || !parsedArguments) {
            return;
          }
          toolCallSummaries.set(toolCallId, {
            description:
              typeof parsedArguments.description === 'string' ? parsedArguments.description : undefined,
            subagentType:
              typeof parsedArguments.subagent_type === 'string'
                ? parsedArguments.subagent_type
                : undefined,
          });
          return;
        }
        if (block.type !== 'SubagentEvent' || !isRecord(block.payload)) {
          return;
        }
        const payload = block.payload;
        const agentId = typeof payload.agent_id === 'string' ? payload.agent_id : undefined;
        const subagentType =
          typeof payload.subagent_type === 'string' ? payload.subagent_type : undefined;
        const parentToolCallId =
          typeof payload.parent_tool_call_id === 'string' ? payload.parent_tool_call_id : undefined;
        const nestedEvent = isRecord(payload.event) ? payload.event : null;
        const nestedType = nestedEvent?.type;
        if (!agentId || typeof nestedType !== 'string') {
          return;
        }
        const summary = parentToolCallId ? toolCallSummaries.get(parentToolCallId) : undefined;
        const title = summary?.description ?? subagentType ?? '子 Agent';
        const resolvedSubagentType = summary?.subagentType ?? subagentType ?? 'subagent';
        if (nestedType === 'TurnBegin' && !activeSubagents.has(agentId)) {
          beforeEvents.push({
            cmd: 'session:created',
            payload: {
              agentSessionId: agentId,
              status: 'ok',
              name: title,
              sessionType: 'subagent',
              parentSessionId: rootSessionId,
              subagentType: resolvedSubagentType,
            },
            meta: {
              agentSessionId: rootSessionId,
            },
          });
          beforeEvents.push({
            cmd: 'query:state',
            payload: {
              agentSessionId: agentId,
              isStreaming: true,
            },
            meta: {
              agentSessionId: agentId,
            },
          });
          activeSubagents.add(agentId);
          return;
        }
        if (nestedType === 'TurnEnd' && activeSubagents.has(agentId)) {
          afterEvents.push({
            cmd: 'query:state',
            payload: {
              agentSessionId: agentId,
              isStreaming: false,
            },
            meta: {
              agentSessionId: agentId,
            },
          });
          activeSubagents.delete(agentId);
          return;
        }
      });
    }
    nextEvents.push(...beforeEvents);
    nextEvents.push(event);
    nextEvents.push(...afterEvents);
  });

  return { events: nextEvents };
};

export const buildAiChatMockReplayEvents = (
  turn: AiChatMockReplayTurn | LegacyAiChatMockReplayTurn,
  agentSessionId: string
): (AgentWsEvent & { event?: string })[] => {
  const normalized = buildSyntheticSubagentEvents(normalizeAiChatMockReplayTurn(turn), agentSessionId);
  const subagentSessionIds = new Set<string>();
  normalized.events.forEach((event) => {
    if (event.cmd !== 'session:created') {
      return;
    }
    const payload = event.payload as SessionCreatedPayload;
    if (payload.sessionType === 'subagent' && payload.agentSessionId) {
      subagentSessionIds.add(payload.agentSessionId);
    }
  });

  const remapRootSessionId = (sessionId: string | undefined | null) => {
    if (!sessionId) {
      return agentSessionId;
    }
    return subagentSessionIds.has(sessionId) ? sessionId : agentSessionId;
  };

  return normalized.events.map((event) => {
    const payload =
      isRecord(event.payload) && (
        'agentSessionId' in event.payload || 'parentSessionId' in event.payload
      )
        ? {
            ...event.payload,
            ...('agentSessionId' in event.payload
              ? {
                  agentSessionId: remapRootSessionId(
                    readSessionId(event.payload, 'agentSessionId')
                  ),
                }
              : {}),
            ...('parentSessionId' in event.payload
              ? {
                  parentSessionId: remapRootSessionId(
                    readSessionId(event.payload, 'parentSessionId')
                  ),
                }
              : {}),
          }
        : event.payload;

    return {
      cmd: event.cmd,
      payload,
      meta: {
        agentSessionId: remapRootSessionId(event.meta?.agentSessionId),
        ...(event.meta?.subagentId ? { subagentId: event.meta.subagentId } : {}),
        traceId: createTraceId(),
      },
    };
  });
};

export const isQueryStreamingFinished = (
  action: string | undefined,
  payload: QueryStatePayload | { isStreaming?: boolean } | undefined
) => action === 'query:state' && payload?.isStreaming === false;
