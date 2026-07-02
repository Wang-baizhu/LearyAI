// userSlice.test.ts 负责验证用户会话 Redux 分片的状态迁移。
import { describe, expect, it } from 'vitest';
import reducer, { clearSession, setSession } from '../userSlice';

describe('userSlice', () => {
  it('会通过 setSession 写入当前用户会话', () => {
    const nextState = reducer(
      undefined,
      setSession({
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        phone: '13800000000',
        userMode: 'normal',
      })
    );

    expect(nextState.session).toEqual({
      id: 1,
      name: 'Alice',
      email: 'alice@example.com',
      phone: '13800000000',
      userMode: 'normal',
    });
  });

  it('会通过 setSession 支持清空会话', () => {
    const nextState = reducer(
      {
        session: {
          id: 1,
          name: 'Alice',
          email: 'alice@example.com',
        },
      },
      setSession(null)
    );

    expect(nextState.session).toBeNull();
  });

  it('会通过 clearSession 清空当前会话', () => {
    const nextState = reducer(
      {
        session: {
          id: 2,
          name: 'Bob',
          email: 'bob@example.com',
        },
      },
      clearSession()
    );

    expect(nextState.session).toBeNull();
  });
});
