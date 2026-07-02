// mapSessionSummary.test.ts 负责验证 AI Chat 会话摘要映射逻辑。
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mapSessionSummary } from '../mapSessionSummary';

describe('mapSessionSummary', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('会映射基础字段并初始化统计信息', () => {
    const result = mapSessionSummary({
      agentSessionId: 'session-1',
      name: '会话标题',
      kbId: '  kb-1  ',
      updatedAt: '2026-03-29T10:00:00.000Z',
    });

    expect(result).toEqual({
      id: 'session-1',
      name: '会话标题',
      kbId: 'kb-1',
      updatedAt: '2026-03-29T10:00:00.000Z',
      sessionType: 'main',
      parentSessionId: null,
      subagentType: null,
      status: null,
      messageCount: 0,
      referenceCount: 0,
      isStreaming: false,
      pendingPermissionCount: 0,
      pendingQuestionCount: 0,
    });
  });

  it('会在名称和更新时间缺失时使用默认值', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-29T12:34:56.000Z'));

    const result = mapSessionSummary({
      agentSessionId: 'session-2',
      name: undefined as unknown as string,
      kbId: '   ',
      updatedAt: undefined as unknown as string,
    });

    expect(result).toEqual({
      id: 'session-2',
      name: '未命名会话',
      kbId: null,
      updatedAt: '2026-03-29T12:34:56.000Z',
      sessionType: 'main',
      parentSessionId: null,
      subagentType: null,
      status: null,
      messageCount: 0,
      referenceCount: 0,
      isStreaming: false,
      pendingPermissionCount: 0,
      pendingQuestionCount: 0,
    });
  });
});
