// useAiChatSocket.test.ts 负责验证 session.context 的上下文等待队列仅用于首屏加载。
import { describe, expect, it } from 'vitest';
import { shouldMarkContextRequested } from '../useAiChatSocket';

describe('shouldMarkContextRequested', () => {
  it('首屏 session.context 会进入等待上下文队列', () => {
    expect(shouldMarkContextRequested('session.context', {}, 'session-1')).toBe(true);
  });

  it('历史分页 session.context 不会阻塞增量 streaming', () => {
    expect(
      shouldMarkContextRequested('session.context', { beforeSeq: 120 }, 'session-1')
    ).toBe(false);
  });

  it('非 session.context 请求不会标记上下文等待', () => {
    expect(shouldMarkContextRequested('session.status', {}, 'session-1')).toBe(false);
  });
});
