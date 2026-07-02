// normalizeSocketStatusEvents 负责把查询状态与结束类 socket 事件转换为统一归一化事件。
import type { AgentWsRuntimeEnvelope } from '../../../shared/api/agentWs';
import type { NormalizedEvent } from '../../../entities';
import { resolveEnvelopeTargetSessionId } from './resolveEnvelopeTargetSessionId';
import type {
  HookRequestPayload,
  PermissionRequestPayload,
  QueryStatePayload,
  QuestionRequestPayload,
  ToolRequestPayload,
} from '../model/types';

export const normalizeSocketStatusEvents = (
  envelope: AgentWsRuntimeEnvelope
): NormalizedEvent[] => {
  const action = envelope.cmd ?? envelope.event;
  if (!action) return [];

  switch (action) {
    case 'query:state': {
      const payload = envelope.payload as QueryStatePayload;
      const targetSessionId = resolveEnvelopeTargetSessionId(envelope);
      if (!targetSessionId) return [];
      return [
        {
          type: 'session.status',
          agentSessionId: targetSessionId,
          status: { exists: true, isStreaming: payload.isStreaming },
        },
      ];
    }
    case 'agent.result':
    case 'agent.cancelled': {
      const targetSessionId = resolveEnvelopeTargetSessionId(envelope);
      if (!targetSessionId) return [];
      return [
        {
          type: 'session.status',
          agentSessionId: targetSessionId,
          status: { exists: true, isStreaming: false },
        },
        {
          // 兜底结束加载态，避免时序边界导致 needContext 残留。
          type: 'session.needContext',
          agentSessionId: targetSessionId,
          needContext: false,
        },
        {
          type: 'session.terminalStatus',
          agentSessionId: targetSessionId,
          status: action === 'agent.cancelled' ? 'killed' : 'completed',
        },
      ];
    }
    case 'permission:request': {
      const payload = envelope.payload as PermissionRequestPayload;
      const targetSessionId = envelope.meta?.agentSessionId ?? null;
      if (!targetSessionId) return [];
      return [
        {
          type: 'permission.request',
          agentSessionId: targetSessionId,
          request: {
            ...payload,
            requestId: payload.requestId ?? payload.toolCallId,
            subagentId: payload.subagentId ?? undefined,
            createdAt: new Date().toISOString(),
          },
        },
      ];
    }
    case 'question:request': {
      const payload = envelope.payload as QuestionRequestPayload;
      const targetSessionId =
        envelope.meta?.agentSessionId ?? payload.agentSessionId ?? null;
      if (!targetSessionId) return [];
      return [
        {
          type: 'question.request',
          agentSessionId: targetSessionId,
          request: {
            requestId: payload.requestId,
            toolCallId: payload.toolCallId ?? undefined,
            questions: payload.questions.map((item) => ({
              question: item.question,
              header: item.header ?? undefined,
              options: item.options,
              multiSelect: item.multi_select,
              body: item.body ?? undefined,
              otherLabel: item.other_label ?? undefined,
              otherDescription: item.other_description ?? undefined,
            })),
            subagentId: payload.subagentId ?? undefined,
            createdAt: new Date().toISOString(),
          },
        },
      ];
    }
    case 'hook:request': {
      const payload = envelope.payload as HookRequestPayload;
      const targetSessionId =
        envelope.meta?.agentSessionId ?? payload.agentSessionId ?? null;
      if (!targetSessionId) return [];
      return [
        {
          type: 'hook.request',
          agentSessionId: targetSessionId,
          request: {
            requestId: payload.requestId,
            subscriptionId: payload.subscriptionId ?? undefined,
            hookEvent: payload.hookEvent,
            target: payload.target ?? undefined,
            inputData: payload.inputData ?? undefined,
            options: payload.options ?? undefined,
            subagentId: payload.subagentId ?? undefined,
            createdAt: new Date().toISOString(),
          },
        },
      ];
    }
    case 'tool:request': {
      const payload = envelope.payload as ToolRequestPayload;
      const targetSessionId =
        envelope.meta?.agentSessionId ?? payload.agentSessionId ?? null;
      if (!targetSessionId) return [];
      return [
        {
          type: 'tool.request',
          agentSessionId: targetSessionId,
          request: {
            toolCallId: payload.toolCallId,
            name: payload.name,
            arguments: payload.arguments ?? undefined,
            subagentId: payload.subagentId ?? undefined,
            createdAt: new Date().toISOString(),
          },
        },
      ];
    }
    default:
      return [];
  }
};
