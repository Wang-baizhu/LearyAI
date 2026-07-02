// useAiChatPermission.test.ts 负责验证权限请求 hook 的 dispatch 与响应封装逻辑。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useCallback: vi.fn((fn) => fn),
  useAppDispatch: vi.fn(),
  dispatch: vi.fn(),
  addPendingPermission: vi.fn((payload) => ({ type: 'aiChat/addPendingPermission', payload })),
  resolveFirstPermission: vi.fn((payload) => ({ type: 'aiChat/resolveFirstPermission', payload })),
  resolvePermission: vi.fn((payload) => ({ type: 'aiChat/resolvePermission', payload })),
}));

vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useCallback: mocks.useCallback,
  };
});

vi.mock('@/app/store/hooks', () => ({
  useAppDispatch: mocks.useAppDispatch,
}));

vi.mock('../../../../../entities', () => ({
  addPendingPermission: mocks.addPendingPermission,
  resolveFirstPermission: mocks.resolveFirstPermission,
  resolvePermission: mocks.resolvePermission,
}));

import { useAiChatPermission } from '../../useAiChatPermission';

describe('useAiChatPermission', () => {
  beforeEach(() => {
    mocks.useCallback.mockClear();
    mocks.dispatch.mockReset();
    mocks.useAppDispatch.mockReset();
    mocks.useAppDispatch.mockReturnValue(mocks.dispatch);
    mocks.addPendingPermission.mockReset();
    mocks.addPendingPermission.mockImplementation((payload) => ({
      type: 'aiChat/addPendingPermission',
      payload,
    }));
    mocks.resolveFirstPermission.mockReset();
    mocks.resolveFirstPermission.mockImplementation((payload) => ({
      type: 'aiChat/resolveFirstPermission',
      payload,
    }));
    mocks.resolvePermission.mockReset();
    mocks.resolvePermission.mockImplementation((payload) => ({
      type: 'aiChat/resolvePermission',
      payload,
    }));
  });

  it('handlePermissionRequest 只会在存在 agentSessionId 时派发待处理权限', () => {
    const { handlePermissionRequest } = useAiChatPermission();

    handlePermissionRequest({ toolCallId: 'tool-1' } as never);
    handlePermissionRequest({ toolCallId: 'tool-1' } as never, 'session-1');

    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
    expect(mocks.dispatch).toHaveBeenCalledWith({
      type: 'aiChat/addPendingPermission',
      payload: {
        agentSessionId: 'session-1',
        request: { toolCallId: 'tool-1' },
      },
    });
  });

  it('handlePermissionAck 会优先按 toolCallId 精确确认，否则确认首个权限', () => {
    const { handlePermissionAck } = useAiChatPermission();

    handlePermissionAck('session-1', 'tool-1');
    handlePermissionAck('session-1');
    handlePermissionAck(undefined, 'tool-2');

    expect(mocks.dispatch).toHaveBeenNthCalledWith(1, {
      type: 'aiChat/resolvePermission',
      payload: { agentSessionId: 'session-1', toolCallId: 'tool-1' },
    });
    expect(mocks.dispatch).toHaveBeenNthCalledWith(2, {
      type: 'aiChat/resolveFirstPermission',
      payload: { agentSessionId: 'session-1' },
    });
  });

  it('respondPermission 会封装 requestId 与 decision 后调用 sendEnvelope', () => {
    const sendEnvelope = vi.fn();
    const { respondPermission } = useAiChatPermission();

    respondPermission(
      {
        toolCallId: 'tool-1',
        decision: 'approve',
      },
      'session-1',
      sendEnvelope
    );

    respondPermission(
      {
        toolCallId: 'tool-2',
        requestId: 'request-2',
        decision: 'reject',
      },
      null,
      sendEnvelope
    );

    expect(sendEnvelope).toHaveBeenCalledTimes(1);
    expect(sendEnvelope).toHaveBeenCalledWith(
      'permission.respond',
      {
        agentSessionId: 'session-1',
        requestId: 'tool-1',
        toolCallId: 'tool-1',
        decision: 'approve',
      },
      'session-1'
    );
  });
});
