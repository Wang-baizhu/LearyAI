// socketEnvelopeHandler.test.ts 负责验证 WebSocket envelope 分发逻辑。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createTraceId: vi.fn(() => 'trace-1'),
  applyNormalizedEvents: vi.fn((payload) => ({ type: 'applyNormalizedEvents', payload })),
  clearSession: vi.fn((payload) => ({ type: 'clearSession', payload })),
  promoteTempSession: vi.fn((payload) => ({ type: 'promoteTempSession', payload })),
  resolveHookRequest: vi.fn((payload) => ({ type: 'resolveHookRequest', payload })),
  resolveFirstPermission: vi.fn((payload) => ({ type: 'resolveFirstPermission', payload })),
  resolvePermission: vi.fn((payload) => ({ type: 'resolvePermission', payload })),
  resolveQuestionRequest: vi.fn((payload) => ({ type: 'resolveQuestionRequest', payload })),
  resolveToolRequest: vi.fn((payload) => ({ type: 'resolveToolRequest', payload })),
  setConnectionStatus: vi.fn((payload) => ({ type: 'setConnectionStatus', payload })),
  setPendingSessionCreate: vi.fn((payload) => ({ type: 'setPendingSessionCreate', payload })),
  setSessionNeedContext: vi.fn((payload) => ({ type: 'setSessionNeedContext', payload })),
  setSubagentContextNeedLoad: vi.fn((payload) => ({ type: 'setSubagentContextNeedLoad', payload })),
  normalizeSocketStatusEvents: vi.fn(),
}));

vi.mock('@/shared/lib/traceId', () => ({
  createTraceId: mocks.createTraceId,
}));

vi.mock('../../../../../entities', () => ({
  applyNormalizedEvents: mocks.applyNormalizedEvents,
  clearSession: mocks.clearSession,
  promoteTempSession: mocks.promoteTempSession,
  resolveHookRequest: mocks.resolveHookRequest,
  resolveFirstPermission: mocks.resolveFirstPermission,
  resolvePermission: mocks.resolvePermission,
  resolveQuestionRequest: mocks.resolveQuestionRequest,
  resolveToolRequest: mocks.resolveToolRequest,
  setConnectionStatus: mocks.setConnectionStatus,
  setPendingSessionCreate: mocks.setPendingSessionCreate,
  setSessionNeedContext: mocks.setSessionNeedContext,
  setSubagentContextNeedLoad: mocks.setSubagentContextNeedLoad,
  TEMP_SESSION_ID: 'temp-session',
}));

vi.mock('../../../lib/normalizeSocketStatusEvents', () => ({
  normalizeSocketStatusEvents: mocks.normalizeSocketStatusEvents,
}));

import { buildDebugMockEnvelope, processSocketEnvelope } from '../socketEnvelopeHandler';

describe('socketEnvelopeHandler', () => {
  beforeEach(() => {
    mocks.applyNormalizedEvents.mockReset();
    mocks.applyNormalizedEvents.mockImplementation((payload) => ({ type: 'applyNormalizedEvents', payload }));
    mocks.clearSession.mockReset();
    mocks.clearSession.mockImplementation((payload) => ({ type: 'clearSession', payload }));
    mocks.promoteTempSession.mockReset();
    mocks.promoteTempSession.mockImplementation((payload) => ({ type: 'promoteTempSession', payload }));
    mocks.resolveHookRequest.mockReset();
    mocks.resolveHookRequest.mockImplementation((payload) => ({ type: 'resolveHookRequest', payload }));
    mocks.resolveFirstPermission.mockReset();
    mocks.resolveFirstPermission.mockImplementation((payload) => ({ type: 'resolveFirstPermission', payload }));
    mocks.resolvePermission.mockReset();
    mocks.resolvePermission.mockImplementation((payload) => ({ type: 'resolvePermission', payload }));
    mocks.resolveQuestionRequest.mockReset();
    mocks.resolveQuestionRequest.mockImplementation((payload) => ({ type: 'resolveQuestionRequest', payload }));
    mocks.resolveToolRequest.mockReset();
    mocks.resolveToolRequest.mockImplementation((payload) => ({ type: 'resolveToolRequest', payload }));
    mocks.setConnectionStatus.mockReset();
    mocks.setConnectionStatus.mockImplementation((payload) => ({ type: 'setConnectionStatus', payload }));
    mocks.setPendingSessionCreate.mockReset();
    mocks.setPendingSessionCreate.mockImplementation((payload) => ({
      type: 'setPendingSessionCreate',
      payload,
    }));
    mocks.setSessionNeedContext.mockReset();
    mocks.setSessionNeedContext.mockImplementation((payload) => ({
      type: 'setSessionNeedContext',
      payload,
    }));
    mocks.setSubagentContextNeedLoad.mockReset();
    mocks.setSubagentContextNeedLoad.mockImplementation((payload) => ({
      type: 'setSubagentContextNeedLoad',
      payload,
    }));
    mocks.normalizeSocketStatusEvents.mockReset();
  });

  const createParams = () => ({
    activeSessionId: 'temp-session',
    sessions: [],
    dispatch: vi.fn(),
    handlers: {
      handleSessionList: vi.fn(),
      handleSessionCreated: vi.fn(),
      handleSessionRenamed: vi.fn(),
      handleSessionRemoved: vi.fn(),
      handleSessionStatus: vi.fn(),
    },
    wireProcessor: {
      processContext: vi.fn(() => ['context-event'] as never[]),
      processUpdate: vi.fn(() => ['update-event'] as never[]),
      resetSession: vi.fn(),
    },
    dispatchWithStreamThrottle: vi.fn(),
    enqueueUpdate: vi.fn(),
    shouldQueueUpdate: vi.fn(() => false),
    consumeContextReady: vi.fn(() => [] as never[]),
    clearContextSession: vi.fn(),
    clearTextQueueBySession: vi.fn(),
    flushTextQueueBySession: vi.fn(),
    handleConnectionReplaced: vi.fn(),
    onSessionResyncRequired: vi.fn(),
  });

  it('session/context/update/request/error 分支会走对应派发逻辑', () => {
    const params = createParams();
    mocks.normalizeSocketStatusEvents.mockReturnValue(['normalized']);

    processSocketEnvelope({
      ...params,
      envelope: {
        cmd: 'error',
        payload: { message: '连接失败' },
        meta: { agentSessionId: 'session-1' },
      } as never,
    });
    processSocketEnvelope({
      ...params,
      envelope: {
        cmd: 'session:list',
        payload: { sessions: [] },
        meta: { agentSessionId: 'session-1' },
      } as never,
    });
    processSocketEnvelope({
      ...params,
      envelope: {
        cmd: 'session:created',
        payload: { agentSessionId: 'session-1' },
        meta: { agentSessionId: 'session-1' },
      } as never,
    });
    processSocketEnvelope({
      ...params,
      envelope: {
        cmd: 'session:context',
        payload: { blocks: [], isStreaming: true },
        meta: { agentSessionId: 'session-1' },
      } as never,
    });
    processSocketEnvelope({
      ...params,
      envelope: {
        cmd: 'messages:updated',
        payload: { blocks: [{ type: 'ContentPart' }] },
        meta: { agentSessionId: 'session-1' },
      } as never,
    });
    processSocketEnvelope({
      ...params,
      envelope: {
        cmd: 'permission:ack',
        payload: { toolCallId: 'tool-1' },
        meta: { agentSessionId: 'session-1' },
      } as never,
    });
    processSocketEnvelope({
      ...params,
      envelope: {
        cmd: 'question:ack',
        payload: { requestId: 'question-1' },
        meta: { agentSessionId: 'session-1' },
      } as never,
    });
    processSocketEnvelope({
      ...params,
      envelope: {
        cmd: 'hook:ack',
        payload: { requestId: 'hook-1' },
        meta: { agentSessionId: 'session-1' },
      } as never,
    });
    processSocketEnvelope({
      ...params,
      envelope: {
        cmd: 'tool:ack',
        payload: {},
        meta: { agentSessionId: 'session-1' },
      } as never,
    });
    processSocketEnvelope({
      ...params,
      envelope: {
        cmd: 'permission:request',
        payload: { type: 'permission' },
        meta: { agentSessionId: 'session-1' },
      } as never,
    });

    expect(mocks.promoteTempSession).toHaveBeenCalledWith({ agentSessionId: 'session-1' });
    expect(mocks.setPendingSessionCreate).toHaveBeenCalledWith(false);
    expect(mocks.setConnectionStatus).toHaveBeenCalledWith({
      status: 'error',
      error: '连接失败',
    });
    expect(params.handlers.handleSessionList).toHaveBeenCalled();
    expect(params.handlers.handleSessionCreated).toHaveBeenCalled();
    expect(params.wireProcessor.processContext).toHaveBeenCalledWith('session-1', [], true, undefined);
    expect(params.dispatch).toHaveBeenCalledWith({
      type: 'applyNormalizedEvents',
      payload: ['context-event'],
    });
    expect(params.wireProcessor.processUpdate).toHaveBeenCalledWith('session-1', [
      { type: 'ContentPart' },
    ]);
    expect(params.dispatchWithStreamThrottle).toHaveBeenCalledWith(['update-event']);
    expect(mocks.resolvePermission).toHaveBeenCalledWith({
      agentSessionId: 'session-1',
      toolCallId: 'tool-1',
    });
    expect(mocks.resolveQuestionRequest).toHaveBeenCalledWith({
      agentSessionId: 'session-1',
      requestId: 'question-1',
    });
    expect(mocks.resolveHookRequest).toHaveBeenCalledWith({
      agentSessionId: 'session-1',
      requestId: 'hook-1',
    });
    expect(mocks.resolveToolRequest).toHaveBeenCalledWith({
      agentSessionId: 'session-1',
      toolCallId: undefined,
    });
    expect(mocks.normalizeSocketStatusEvents).toHaveBeenCalled();
    expect(params.flushTextQueueBySession).toHaveBeenCalledWith('session-1');
  });

  it('removed/queued/debug/connection replaced 分支会清理上下文或走特殊更新', () => {
    const params = createParams();
    params.shouldQueueUpdate.mockReturnValue(true);

    processSocketEnvelope({
      ...params,
      envelope: {
        cmd: 'session:removed',
        payload: { agentSessionId: 'session-1' },
        meta: { agentSessionId: 'session-1' },
      } as never,
    });
    processSocketEnvelope({
      ...params,
      envelope: {
        cmd: 'messages:updated',
        payload: { blocks: [{ type: 'ContentPart' }] },
        meta: { agentSessionId: 'session-1' },
      } as never,
    });
    processSocketEnvelope({
      ...params,
      envelope: {
        cmd: 'connection:replaced',
        payload: { message: '其他设备接管' },
        meta: { agentSessionId: 'session-1' },
      } as never,
    });
    processSocketEnvelope({
      ...params,
      envelope: {
        cmd: 'debug:mock:content',
        payload: {},
        meta: {},
      } as never,
    });

    expect(params.wireProcessor.resetSession).toHaveBeenCalledWith('session-1');
    expect(params.clearContextSession).toHaveBeenCalledWith('session-1');
    expect(params.clearTextQueueBySession).toHaveBeenCalledWith('session-1');
    expect(params.handlers.handleSessionRemoved).toHaveBeenCalledWith({ agentSessionId: 'session-1' });
    expect(params.enqueueUpdate).toHaveBeenCalledWith('session-1', {
      blocks: [{ type: 'ContentPart' }],
    });
    expect(params.handleConnectionReplaced).toHaveBeenCalledWith('其他设备接管');
    expect(params.dispatchWithStreamThrottle).toHaveBeenCalled();
  });

  it('session:resync_required 会清理当前 target 并触发重新拉取', () => {
    const params = createParams();

    processSocketEnvelope({
      ...params,
      envelope: {
        cmd: 'session:resync_required',
        payload: { agentSessionId: 'session-1', reason: 'buffer_overflow' },
        meta: { agentSessionId: 'session-1' },
      } as never,
    });

    expect(params.flushTextQueueBySession).toHaveBeenCalledWith('session-1');
    expect(params.wireProcessor.resetSession).toHaveBeenCalledWith('session-1');
    expect(mocks.clearSession).toHaveBeenCalledWith('session-1');
    expect(params.dispatch).toHaveBeenCalledWith({
      type: 'clearSession',
      payload: 'session-1',
    });
    expect(mocks.setSessionNeedContext).toHaveBeenCalledWith({
      agentSessionId: 'session-1',
      needContext: true,
    });
    expect(params.dispatch).toHaveBeenCalledWith({
      type: 'setSessionNeedContext',
      payload: {
        agentSessionId: 'session-1',
        needContext: true,
      },
    });
    expect(params.clearContextSession).toHaveBeenCalledWith('session-1');
    expect(params.clearTextQueueBySession).toHaveBeenCalledWith('session-1');
    expect(params.onSessionResyncRequired).toHaveBeenCalledWith('session-1');
  });

  it('子 session context 会先 flush 对应文本队列再落库', () => {
    const params = createParams();

    processSocketEnvelope({
      ...params,
      envelope: {
        cmd: 'session:subagent_context',
        payload: {
          subagentId: 'agent-1',
          blocks: [{ type: 'ContentPart' }],
          isStreaming: true,
        },
        meta: {
          agentSessionId: 'session-1',
          subagentId: 'agent-1',
        },
      } as never,
    });

    expect(params.flushTextQueueBySession).toHaveBeenCalledWith('agent-1');
    expect(params.wireProcessor.processContext).toHaveBeenCalledWith(
      'agent-1',
      [{ type: 'ContentPart' }],
      true,
      undefined
    );
    expect(mocks.setSubagentContextNeedLoad).toHaveBeenCalledWith({
      sessionId: 'agent-1',
      needContext: false,
    });
    expect(params.dispatch).toHaveBeenCalledWith({
      type: 'setSubagentContextNeedLoad',
      payload: {
        sessionId: 'agent-1',
        needContext: false,
      },
    });
  });

  it('buildDebugMockEnvelope 会用 traceId 与默认会话组装 mock 消息', () => {
    expect(buildDebugMockEnvelope(null)).toEqual({
      cmd: 'messages:updated',
      payload: {
        blocks: [
          {
            type: 'ContentPart',
            payload: {
              type: 'text',
              text: 'mockcontent block: 这是一条本地调试模拟接收消息。',
            },
          },
        ],
        isStreaming: false,
      },
      meta: {
        agentSessionId: 'temp-session',
        traceId: 'trace-1',
      },
    });
  });

  it('buildDebugMockEnvelope 支持自定义 mock 文本', () => {
    expect(buildDebugMockEnvelope('session-2', '自定义回复')).toEqual({
      cmd: 'messages:updated',
      payload: {
        blocks: [
          {
            type: 'ContentPart',
            payload: {
              type: 'text',
              text: '自定义回复',
            },
          },
        ],
        isStreaming: false,
      },
      meta: {
        agentSessionId: 'session-2',
        traceId: 'trace-1',
      },
    });
  });
});
