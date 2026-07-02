// socketEnvelopeHandler 负责分发 WS envelope 到具体业务处理分支。
import type { AppDispatch } from '@/app/store';
import { createTraceId } from '@/shared/lib/traceId';
import { applyNormalizedEvents, clearSession, promoteTempSession, resolveFirstPermission, resolveHookRequest, resolvePermission, resolveQuestionRequest, resolveToolRequest, setConnectionStatus, setPendingSessionCreate, setSessionNeedContext, setSubagentContextNeedLoad, TEMP_SESSION_ID } from '../../../../entities';
import type { AgentSessionSummary } from '../../../../entities';
import { normalizeSocketStatusEvents } from '../../lib/normalizeSocketStatusEvents';
import { resolveEnvelopeTargetSessionId, resolveTargetSessionId } from '../../lib/resolveEnvelopeTargetSessionId';
import type {
  MessagesUpdatedPayload,
  SessionCreatedPayload,
  SessionContextPayload,
  SessionListPayload,
  SessionRemovedPayload,
  SessionRenamedPayload,
  SessionSubagentContextPayload,
  SessionSubagentListPayload,
  SessionSubagentStatePayload,
  SessionSummaryPayload,
  SessionStatusPayload,
} from '../types';
import type { AgentWsRuntimeEnvelope } from '../../../../shared/api/agentWs';
import type { NormalizedEvent } from '../../../../entities';

type SessionHandlers = {
  handleSessionList: (payload: SessionListPayload) => void;
  handleSessionCreated: (payload: SessionCreatedPayload) => void;
  handleSessionRenamed: (payload: SessionRenamedPayload) => void;
  handleSessionRemoved: (payload: SessionRemovedPayload) => void;
  handleSessionStatus: (payload: SessionStatusPayload) => void;
  handleSessionSubagentList?: (payload: SessionSubagentListPayload) => void;
  handleSessionSubagentState?: (payload: SessionSubagentStatePayload) => void;
  handleSessionSummaryUpdated?: (payload: SessionSummaryPayload) => void;
};

type WireBlocksProcessor = {
  processContext: (
    agentSessionId: string,
    blocks: MessagesUpdatedPayload['blocks'],
    isStreaming?: boolean,
    prepend?: boolean
  ) => NormalizedEvent[];
  processUpdate: (
    agentSessionId: string,
    blocks: MessagesUpdatedPayload['blocks']
  ) => NormalizedEvent[];
  resetSession: (agentSessionId: string) => void;
};

type ProcessSocketEnvelopeParams = {
  envelope: AgentWsRuntimeEnvelope | null;
  activeSessionId: string | null;
  sessions: AgentSessionSummary[];
  dispatch: AppDispatch;
  handlers: SessionHandlers | null;
  wireProcessor: WireBlocksProcessor;
  dispatchWithStreamThrottle: (events: NormalizedEvent[]) => void;
  enqueueUpdate: (agentSessionId: string, payload: MessagesUpdatedPayload) => void;
  shouldQueueUpdate: (agentSessionId: string) => boolean;
  consumeContextReady: (agentSessionId: string) => MessagesUpdatedPayload[];
  clearContextSession: (agentSessionId: string) => void;
  clearTextQueueBySession: (agentSessionId: string) => void;
  flushTextQueueBySession: (agentSessionId: string) => void;
  handleConnectionReplaced: (message?: string) => void;
  onSessionResyncRequired?: (agentSessionId: string) => void;
  onSessionContextPage?: (agentSessionId: string, payload: SessionContextPayload) => void;
  onSubagentContextPage?: (
    agentSessionId: string,
    subagentId: string,
    payload: SessionSubagentContextPayload
  ) => void;
};

export const processSocketEnvelope = ({
  envelope,
  activeSessionId,
  sessions,
  dispatch,
  handlers,
  wireProcessor,
  dispatchWithStreamThrottle,
  enqueueUpdate,
  shouldQueueUpdate,
  consumeContextReady,
  clearContextSession,
  clearTextQueueBySession,
  flushTextQueueBySession,
  handleConnectionReplaced,
  onSessionResyncRequired,
  onSessionContextPage,
  onSubagentContextPage,
}: ProcessSocketEnvelopeParams) => {
  if (!envelope || !handlers) return;

  const agentSessionId = envelope.meta?.agentSessionId;
  const targetSessionId = resolveEnvelopeTargetSessionId(envelope);
  const action = envelope.cmd ?? envelope.event;
  if (agentSessionId && activeSessionId === TEMP_SESSION_ID) {
    const isKnownSession = sessions.some((session) => session.id === agentSessionId);
    if (!isKnownSession || action === 'session:created') {
      dispatch(promoteTempSession({ agentSessionId }));
    }
  }

  switch (action) {
    case 'error':
      dispatch(setPendingSessionCreate(false));
      dispatch(
        setConnectionStatus({
          status: 'error',
          error: (envelope.payload as { message?: string }).message ?? '未知错误',
        })
      );
      break;
    case 'session:list':
      handlers.handleSessionList(envelope.payload as SessionListPayload);
      break;
    case 'session:created':
      handlers.handleSessionCreated(envelope.payload as SessionCreatedPayload);
      break;
    case 'session:subagent_list':
      handlers.handleSessionSubagentList?.(envelope.payload as SessionSubagentListPayload);
      break;
    case 'session:subagent_state':
      handlers.handleSessionSubagentState?.(envelope.payload as SessionSubagentStatePayload);
      break;
    case 'session:summary_updated':
      handlers.handleSessionSummaryUpdated?.(envelope.payload as SessionSummaryPayload);
      break;
    case 'session:renamed':
      handlers.handleSessionRenamed(envelope.payload as SessionRenamedPayload);
      break;
    case 'session:removed': {
      const payload = envelope.payload as SessionRemovedPayload;
      wireProcessor.resetSession(payload.agentSessionId);
      clearContextSession(payload.agentSessionId);
      clearTextQueueBySession(payload.agentSessionId);
      handlers.handleSessionRemoved(payload);
      break;
    }
    case 'session:status':
      handlers.handleSessionStatus(envelope.payload as SessionStatusPayload);
      break;
    case 'session:resync_required': {
      if (!targetSessionId) break;
      flushTextQueueBySession(targetSessionId);
      wireProcessor.resetSession(targetSessionId);
      dispatch(clearSession(targetSessionId));
      dispatch(setSessionNeedContext({ agentSessionId: targetSessionId, needContext: true }));
      clearContextSession(targetSessionId);
      clearTextQueueBySession(targetSessionId);
      onSessionResyncRequired?.(targetSessionId);
      break;
    }
    case 'permission:ack': {
      const toolCallId = (envelope.payload as { toolCallId?: string }).toolCallId;
      if (targetSessionId && toolCallId) {
        dispatch(resolvePermission({ agentSessionId: targetSessionId, toolCallId }));
      } else if (targetSessionId) {
        dispatch(resolveFirstPermission({ agentSessionId: targetSessionId }));
      }
      break;
    }
    case 'question:ack': {
      if (targetSessionId) {
        const requestId = (envelope.payload as { requestId?: string }).requestId;
        dispatch(resolveQuestionRequest({ agentSessionId: targetSessionId, requestId }));
      }
      break;
    }
    case 'hook:ack': {
      if (targetSessionId) {
        const requestId = (envelope.payload as { requestId?: string }).requestId;
        dispatch(resolveHookRequest({ agentSessionId: targetSessionId, requestId }));
      }
      break;
    }
    case 'tool:ack': {
      if (targetSessionId) {
        const toolCallId = (envelope.payload as { toolCallId?: string }).toolCallId;
        dispatch(resolveToolRequest({ agentSessionId: targetSessionId, toolCallId }));
      }
      break;
    }
    case 'connection:replaced': {
      const message = (envelope.payload as { message?: string })?.message;
      handleConnectionReplaced(message);
      break;
    }
    case 'session:context': {
      if (!targetSessionId || !agentSessionId) break;
      flushTextQueueBySession(targetSessionId);
      const contextPayload = envelope.payload as SessionContextPayload;
      dispatch(
        applyNormalizedEvents(
          wireProcessor.processContext(
            targetSessionId,
            contextPayload.blocks,
            contextPayload.isStreaming,
            contextPayload.prepend
          )
        )
      );
      onSessionContextPage?.(agentSessionId, contextPayload);
      const pendingUpdates = consumeContextReady(targetSessionId);
      pendingUpdates.forEach((payload) => {
        dispatchWithStreamThrottle(wireProcessor.processUpdate(targetSessionId, payload.blocks));
      });
      break;
    }
    case 'session:subagent_context': {
      if (!agentSessionId) break;
      const contextPayload = envelope.payload as SessionSubagentContextPayload;
      if (!contextPayload.subagentId) {
        break;
      }
      const subagentSessionId = resolveTargetSessionId({
        agentSessionId,
        subagentId: contextPayload.subagentId,
      });
      if (!subagentSessionId) {
        break;
      }
      flushTextQueueBySession(subagentSessionId);
      dispatch(
        applyNormalizedEvents(
          wireProcessor.processContext(
            subagentSessionId,
            contextPayload.blocks,
            contextPayload.isStreaming,
            contextPayload.prepend
          )
        )
      );
      dispatch(
        setSubagentContextNeedLoad({
          sessionId: subagentSessionId,
          needContext: false,
        })
      );
      onSubagentContextPage?.(agentSessionId, contextPayload.subagentId, contextPayload);
      const pendingUpdates = consumeContextReady(subagentSessionId);
      pendingUpdates.forEach((payload) => {
        dispatchWithStreamThrottle(wireProcessor.processUpdate(subagentSessionId, payload.blocks));
      });
      break;
    }
    case 'messages:updated':
      if (!targetSessionId) break;
      if (shouldQueueUpdate(targetSessionId)) {
        enqueueUpdate(targetSessionId, envelope.payload as MessagesUpdatedPayload);
        break;
      }
      dispatchWithStreamThrottle(
        wireProcessor.processUpdate(
          targetSessionId,
          (envelope.payload as MessagesUpdatedPayload).blocks
        )
      );
      break;
    case 'query:state':
    case 'agent.result':
    case 'agent.cancelled':
    case 'permission:request':
    case 'question:request':
    case 'hook:request':
    case 'tool:request': {
      const normalized = normalizeSocketStatusEvents(envelope);
      if (normalized.length > 0) {
        if (targetSessionId) {
          flushTextQueueBySession(targetSessionId);
        }
        dispatch(applyNormalizedEvents(normalized));
      }
      break;
    }
    case 'debug:mock:content': {
      const targetSessionId = agentSessionId?.trim() || TEMP_SESSION_ID;
      dispatchWithStreamThrottle(
        wireProcessor.processUpdate(targetSessionId, [
          {
            type: 'ContentPart',
            payload: {
              type: 'text',
              text: 'mockcontent block: 这是一条本地调试模拟接收消息。',
            },
          },
        ])
      );
      break;
    }
    default:
      break;
  }
};

// mock一个调试用的 envelope，方便本地调试时使用 devtools 直接 dispatch 到 reducer，模拟接收消息的场景。
export const buildDebugMockEnvelope = (
  agentSessionId: string | null,
  text = 'mockcontent block: 这是一条本地调试模拟接收消息。'
) => {
  const targetSessionId = agentSessionId?.trim() || TEMP_SESSION_ID;
  return {
    cmd: 'messages:updated',
    payload: {
      blocks: [
        {
          type: 'ContentPart',
          payload: {
            type: 'text',
            text,
          },
        },
      ],
      isStreaming: false,
    },
    meta: {
      agentSessionId: targetSessionId,
      traceId: createTraceId(),
    },
  } as AgentWsRuntimeEnvelope;
};
