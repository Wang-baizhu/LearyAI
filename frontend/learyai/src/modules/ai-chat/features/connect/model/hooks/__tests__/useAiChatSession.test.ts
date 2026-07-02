// useAiChatSession.test.ts 负责验证临时会话待发送草稿的发送与丢弃判定。
import { describe, expect, it } from 'vitest';
import { TEMP_SESSION_ID } from '@/modules/ai-chat/entities';
import {
  resolveActiveHistoryTarget,
  resolveCommandTarget,
  resolveSendQueryTarget,
  resolveViewCommandTarget,
  resolveWatchedTargetIds,
  resolvePendingTempQueryResolution,
  shouldAbortPendingSessionCreate,
} from '../useAiChatSession';

describe('resolvePendingTempQueryResolution', () => {
  it('临时会话创建成功并切到新会话时允许发送待处理草稿', () => {
    expect(
      resolvePendingTempQueryResolution({
        hasPendingTempQuery: true,
        activeSessionId: 'session-new',
        pendingSessionCreate: false,
        previousSessionIds: new Set(['session-existing']),
      })
    ).toBe('send');
  });

  it('创建失败后切换到已有会话时丢弃待处理草稿', () => {
    expect(
      resolvePendingTempQueryResolution({
        hasPendingTempQuery: true,
        activeSessionId: 'session-existing',
        pendingSessionCreate: false,
        previousSessionIds: new Set(['session-existing']),
      })
    ).toBe('clear');
  });

  it('仍在临时会话或创建中时继续等待', () => {
    expect(
      resolvePendingTempQueryResolution({
        hasPendingTempQuery: true,
        activeSessionId: TEMP_SESSION_ID,
        pendingSessionCreate: true,
        previousSessionIds: new Set(['session-existing']),
      })
    ).toBe('wait');
  });
});

describe('shouldAbortPendingSessionCreate', () => {
  it('建会话期间连接关闭时中止创建态', () => {
    expect(
      shouldAbortPendingSessionCreate({
        connectionStatus: 'closed',
        pendingSessionCreate: true,
      })
    ).toBe(true);
  });

  it('建会话期间连接报错时中止创建态', () => {
    expect(
      shouldAbortPendingSessionCreate({
        connectionStatus: 'error',
        pendingSessionCreate: true,
      })
    ).toBe(true);
  });

  it('未处于建会话状态或连接正常时不处理中止', () => {
    expect(
      shouldAbortPendingSessionCreate({
        connectionStatus: 'open',
        pendingSessionCreate: true,
      })
    ).toBe(false);
    expect(
      shouldAbortPendingSessionCreate({
        connectionStatus: 'closed',
        pendingSessionCreate: false,
      })
    ).toBe(false);
  });
});

describe('resolveWatchedTargetIds', () => {
  it('只订阅当前查看的真实 session', () => {
    expect([...resolveWatchedTargetIds('session-1')]).toEqual(['session-1']);
  });

  it('临时会话或空会话不建立 watch', () => {
    expect([...resolveWatchedTargetIds(TEMP_SESSION_ID)]).toEqual([]);
    expect([...resolveWatchedTargetIds(null)]).toEqual([]);
  });
});

describe('resolveCommandTarget', () => {
  it('主会话前台时直接返回主会话 target', () => {
    expect(
      resolveCommandTarget({
        activeSessionId: 'session-1',
        sessions: [{ id: 'session-1', name: '主会话', updatedAt: '', messageCount: 0, referenceCount: 0, isStreaming: false }],
      })
    ).toEqual({
      agentSessionId: 'session-1',
      subagentId: null,
    });
  });

  it('子会话前台时返回父会话 + subagentId，避免取消链路依赖后端反查', () => {
    expect(
      resolveCommandTarget({
        activeSessionId: 'agent-1',
        sessions: [
          { id: 'session-1', name: '主会话', updatedAt: '', messageCount: 0, referenceCount: 0, isStreaming: false },
          {
            id: 'agent-1',
            name: '子会话',
            updatedAt: '',
            messageCount: 0,
            referenceCount: 0,
            isStreaming: true,
            sessionType: 'subagent',
            parentSessionId: 'session-1',
            subagentType: 'coder',
          },
        ],
      })
    ).toEqual({
      agentSessionId: 'session-1',
      subagentId: 'agent-1',
    });
  });
});

describe('resolveViewCommandTarget', () => {
  it('主 session 内切到子 agent 视图时，取消目标应落到该子 agent', () => {
    expect(
      resolveViewCommandTarget({
        activeSessionId: 'session-1',
        activeSessionView: { kind: 'subagent', sessionId: 'agent-1' },
        sessions: [
          { id: 'session-1', name: '主会话', updatedAt: '', messageCount: 0, referenceCount: 0, isStreaming: false },
          {
            id: 'agent-1',
            name: '子会话',
            updatedAt: '',
            messageCount: 0,
            referenceCount: 0,
            isStreaming: true,
            sessionType: 'subagent',
            parentSessionId: 'session-1',
            subagentType: 'coder',
          },
        ],
      })
    ).toEqual({
      agentSessionId: 'session-1',
      subagentId: 'agent-1',
    });
  });

  it('主视图时仍保持主 session 取消目标', () => {
    expect(
      resolveViewCommandTarget({
        activeSessionId: 'session-1',
        activeSessionView: { kind: 'main' },
        sessions: [
          { id: 'session-1', name: '主会话', updatedAt: '', messageCount: 0, referenceCount: 0, isStreaming: false },
        ],
      })
    ).toEqual({
      agentSessionId: 'session-1',
      subagentId: null,
    });
  });
});

describe('resolveActiveHistoryTarget', () => {
  it('主视图时历史分页仍落到主 session', () => {
    expect(
      resolveActiveHistoryTarget({
        activeSessionId: 'session-1',
        activeSessionView: { kind: 'main' },
      })
    ).toEqual({
      paginationKey: 'session-1',
      parentSessionId: 'session-1',
      subagentId: null,
    });
  });

  it('子 agent 视图时历史分页落到当前子 session', () => {
    expect(
      resolveActiveHistoryTarget({
        activeSessionId: 'session-1',
        activeSessionView: { kind: 'subagent', sessionId: 'agent-1' },
      })
    ).toEqual({
      paginationKey: 'agent-1',
      parentSessionId: 'session-1',
      subagentId: 'agent-1',
    });
  });
});

describe('resolveSendQueryTarget', () => {
  it('主视图发送 query 时命中主 session', () => {
    expect(
      resolveSendQueryTarget({
        activeSessionId: 'session-1',
        activeSessionView: { kind: 'main' },
        sessions: [
          {
            id: 'session-1',
            name: '主会话',
            updatedAt: '',
            messageCount: 0,
            referenceCount: 0,
            isStreaming: false,
          },
        ],
      })
    ).toEqual({
      agentSessionId: 'session-1',
      subagentId: null,
      messageSessionId: 'session-1',
    });
  });

  it('子 agent 视图发送 query 时命中父 session + subagentId，并把本地消息落到子 session', () => {
    expect(
      resolveSendQueryTarget({
        activeSessionId: 'session-1',
        activeSessionView: { kind: 'subagent', sessionId: 'agent-1' },
        sessions: [
          {
            id: 'session-1',
            name: '主会话',
            updatedAt: '',
            messageCount: 0,
            referenceCount: 0,
            isStreaming: false,
          },
          {
            id: 'agent-1',
            name: '子会话',
            updatedAt: '',
            messageCount: 0,
            referenceCount: 0,
            isStreaming: true,
            sessionType: 'subagent',
            parentSessionId: 'session-1',
            subagentType: 'coder',
          },
        ],
      })
    ).toEqual({
      agentSessionId: 'session-1',
      subagentId: 'agent-1',
      messageSessionId: 'agent-1',
    });
  });
});
