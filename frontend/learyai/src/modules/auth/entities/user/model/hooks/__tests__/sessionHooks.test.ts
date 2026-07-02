// sessionHooks.test.ts 负责验证用户会话 hooks 对 Redux selector/dispatch 的封装。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useCallback: vi.fn((fn) => fn),
  useAppSelector: vi.fn(),
  useAppDispatch: vi.fn(),
  dispatch: vi.fn(),
  setSession: vi.fn((payload) => ({ type: 'user/setSession', payload })),
}));

vi.mock('react', () => ({
  useCallback: mocks.useCallback,
}));

vi.mock('@/app/store/hooks', () => ({
  useAppSelector: mocks.useAppSelector,
  useAppDispatch: mocks.useAppDispatch,
}));

vi.mock('../../store/userSlice', () => ({
  setSession: mocks.setSession,
}));

import { useCurrentUser, useUserSession } from '../sessionHooks';

describe('sessionHooks', () => {
  beforeEach(() => {
    mocks.useCallback.mockClear();
    mocks.useAppSelector.mockReset();
    mocks.useAppDispatch.mockReset();
    mocks.dispatch.mockReset();
    mocks.useAppDispatch.mockReturnValue(mocks.dispatch);
    mocks.setSession.mockClear();
  });

  it('useUserSession 会暴露当前 session 并通过 dispatch 更新', () => {
    const session = { id: 1, name: 'Leary' };
    mocks.useAppSelector.mockReturnValue(session);

    const result = useUserSession();
    result.setSession({ id: 2, name: 'Case' } as never);

    expect(result.session).toBe(session);
    expect(mocks.setSession).toHaveBeenCalledWith({ id: 2, name: 'Case' });
    expect(mocks.dispatch).toHaveBeenCalledWith({
      type: 'user/setSession',
      payload: { id: 2, name: 'Case' },
    });
  });

  it('useCurrentUser 会直接返回 selector 结果', () => {
    mocks.useAppSelector.mockReturnValue({ id: 7, name: 'Current' });

    expect(useCurrentUser()).toEqual({ id: 7, name: 'Current' });
  });
});
