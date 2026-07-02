// listeners.test.ts 负责验证 AI Chat listener 的上下文回填与分支转发逻辑。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  startAppListening: vi.fn(),
  sendAiChatQuery: vi.fn(),
  enterTempSession: vi.fn(() => ({ type: 'aiChat/enterTempSession' })),
}));

describe('registerAiChatListeners', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.startAppListening.mockReset();
    mocks.sendAiChatQuery.mockReset();
    mocks.enterTempSession.mockReset();
    mocks.enterTempSession.mockReturnValue({ type: 'aiChat/enterTempSession' });
  });

  it('仅注册一次 listener，并在连接打开时补齐上下文后发送请求', async () => {
    vi.doMock('@/app/store/listenerMiddleware', () => ({
      startAppListening: mocks.startAppListening,
    }));
    vi.doMock('../queryBridge', () => ({
      sendAiChatQuery: mocks.sendAiChatQuery,
    }));
    vi.doMock('../../store/slice', () => ({
      TEMP_SESSION_ID: 'temp-session',
      enterTempSession: mocks.enterTempSession,
    }));
    const { registerAiChatListeners } = await import('../listeners');

    registerAiChatListeners();
    registerAiChatListeners();

    expect(mocks.startAppListening).toHaveBeenCalledTimes(1);

    const config = mocks.startAppListening.mock.calls[0][0];
    await config.effect(
      {
        payload: {
          text: '你好',
          projectId: '  ',
          kbId: undefined,
        },
      },
      {
        getState: () => ({
          resourceCenter: { currentContext: { projectId: ' project-1 ', kbId: ' kb-1 ' } },
          aiChat: { connection: { status: 'open' }, activeSessionId: 'session-1' },
        }),
        dispatch: vi.fn(),
      }
    );

    expect(mocks.sendAiChatQuery).toHaveBeenCalledWith({
      text: '你好',
      projectId: 'project-1',
      kbId: 'kb-1',
    });
  });

  it('连接未打开且 waitForConnection=false 时，会在 temp 会话场景下进入临时会话而不是发送请求', async () => {
    vi.doMock('@/app/store/listenerMiddleware', () => ({
      startAppListening: mocks.startAppListening,
    }));
    vi.doMock('../queryBridge', () => ({
      sendAiChatQuery: mocks.sendAiChatQuery,
    }));
    vi.doMock('../../store/slice', () => ({
      TEMP_SESSION_ID: 'temp-session',
      enterTempSession: mocks.enterTempSession,
    }));
    const { registerAiChatListeners } = await import('../listeners');

    registerAiChatListeners();
    const config = mocks.startAppListening.mock.calls[0][0];
    const dispatch = vi.fn();

    await config.effect(
      {
        payload: {
          text: '稍后发送',
          waitForConnection: false,
        },
      },
      {
        getState: () => ({
          resourceCenter: { currentContext: { projectId: 'project-1', kbId: 'kb-1' } },
          aiChat: { connection: { status: 'connecting' }, activeSessionId: 'temp-session' },
        }),
        dispatch,
      }
    );

    expect(mocks.sendAiChatQuery).not.toHaveBeenCalled();
    expect(mocks.enterTempSession).toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith({ type: 'aiChat/enterTempSession' });
  });

  it('连接未打开但 waitForConnection=true 时仍会排队发送', async () => {
    vi.doMock('@/app/store/listenerMiddleware', () => ({
      startAppListening: mocks.startAppListening,
    }));
    vi.doMock('../queryBridge', () => ({
      sendAiChatQuery: mocks.sendAiChatQuery,
    }));
    vi.doMock('../../store/slice', () => ({
      TEMP_SESSION_ID: 'temp-session',
      enterTempSession: mocks.enterTempSession,
    }));
    const { registerAiChatListeners } = await import('../listeners');

    registerAiChatListeners();
    const config = mocks.startAppListening.mock.calls[0][0];

    await config.effect(
      {
        payload: {
          text: '排队消息',
          waitForConnection: true,
          projectId: 'project-2',
          kbId: 'kb-2',
        },
      },
      {
        getState: () => ({
          resourceCenter: { currentContext: { projectId: 'project-1', kbId: 'kb-1' } },
          aiChat: { connection: { status: 'closed' }, activeSessionId: 'session-2' },
        }),
        dispatch: vi.fn(),
      }
    );

    expect(mocks.sendAiChatQuery).toHaveBeenCalledWith({
      text: '排队消息',
      waitForConnection: true,
      projectId: 'project-2',
      kbId: 'kb-2',
    });
  });
});
