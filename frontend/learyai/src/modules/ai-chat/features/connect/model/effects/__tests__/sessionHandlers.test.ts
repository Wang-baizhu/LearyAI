// sessionHandlers.test.ts 负责验证会话事件处理器的派发行为。
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TEMP_SESSION_ID } from '@/modules/ai-chat/entities';

const mocks = vi.hoisted(() => ({
  removeSession: vi.fn((payload) => ({ type: 'removeSession', payload })),
  promoteTempSession: vi.fn((payload) => ({ type: 'promoteTempSession', payload })),
  setActiveSessionId: vi.fn((payload) => ({ type: 'setActiveSessionId', payload })),
  setPendingSessionCreate: vi.fn((payload) => ({ type: 'setPendingSessionCreate', payload })),
  setSessionStatus: vi.fn((payload) => ({ type: 'setSessionStatus', payload })),
  setSessions: vi.fn((payload) => ({ type: 'setSessions', payload })),
  setSubagentSessions: vi.fn((payload) => ({ type: 'setSubagentSessions', payload })),
  upsertSession: vi.fn((payload) => ({ type: 'upsertSession', payload })),
  mapSessionSummary: vi.fn(),
}));

vi.mock('@/modules/ai-chat/entities', () => ({
  removeSession: mocks.removeSession,
  promoteTempSession: mocks.promoteTempSession,
  setActiveSessionId: mocks.setActiveSessionId,
  setPendingSessionCreate: mocks.setPendingSessionCreate,
  setSessionStatus: mocks.setSessionStatus,
  setSessions: mocks.setSessions,
  setSubagentSessions: mocks.setSubagentSessions,
  TEMP_SESSION_ID: '__temp_session__',
  upsertSession: mocks.upsertSession,
}));

vi.mock('../../../lib/mapSessionSummary', () => ({
  mapSessionSummary: mocks.mapSessionSummary,
}));

import { createSessionHandlers, shouldActivateCreatedSession } from '../sessionHandlers';

describe('sessionHandlers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-29T00:00:00.000Z'));
    mocks.removeSession.mockReset();
    mocks.promoteTempSession.mockReset();
    mocks.setActiveSessionId.mockReset();
    mocks.setPendingSessionCreate.mockReset();
    mocks.setSessionStatus.mockReset();
    mocks.setSessions.mockReset();
    mocks.setSubagentSessions.mockReset();
    mocks.upsertSession.mockReset();
    mocks.mapSessionSummary.mockReset();
    for (const key of [
      'removeSession',
      'promoteTempSession',
      'setActiveSessionId',
      'setPendingSessionCreate',
      'setSessionStatus',
      'setSessions',
      'setSubagentSessions',
      'upsertSession',
    ] as const) {
      mocks[key].mockImplementation((payload) => ({ type: key, payload }));
    }
  });

  it('handleSessionList 会映射排序列表，并在当前会话未锁定时保留 active 会话', () => {
    const dispatch = vi.fn();
    const sendEnvelope = vi.fn();
    const onSessionListPage = vi.fn();
    mocks.mapSessionSummary
      .mockReturnValueOnce({ id: 'session-1', updatedAt: '2026-03-28T00:00:00.000Z', kbId: 'kb-1' })
      .mockReturnValueOnce({ id: 'session-2', updatedAt: '2026-03-29T00:00:00.000Z', kbId: 'kb-1' });

    const handlers = createSessionHandlers({
      dispatch,
      sessions: [],
      subagentSessionsByParent: {},
      activeSessionId: 'session-1',
      removedSessionIds: {},
      sendEnvelope,
      currentKbId: 'kb-1',
      onSessionListPage,
    });

    handlers.handleSessionList({
      sessions: [{ id: 'raw-1' }, { id: 'raw-2' }],
      hasMore: true,
      nextCursor: 'cursor-1',
    } as never);

    expect(mocks.setSessions).toHaveBeenCalledWith([
      { id: 'session-2', updatedAt: '2026-03-29T00:00:00.000Z', kbId: 'kb-1' },
      { id: 'session-1', updatedAt: '2026-03-28T00:00:00.000Z', kbId: 'kb-1' },
    ]);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'setSessions',
      payload: [
        { id: 'session-2', updatedAt: '2026-03-29T00:00:00.000Z', kbId: 'kb-1' },
        { id: 'session-1', updatedAt: '2026-03-28T00:00:00.000Z', kbId: 'kb-1' },
      ],
    });
    expect(mocks.setActiveSessionId).not.toHaveBeenCalled();
    expect(sendEnvelope).toHaveBeenCalledWith('session.status', { agentSessionId: 'session-1' }, 'session-1');
    expect(onSessionListPage).toHaveBeenCalledWith({
      sessions: [{ id: 'raw-1' }, { id: 'raw-2' }],
      hasMore: true,
      nextCursor: 'cursor-1',
    });
  });

  it('handleSessionList 在 append 分页时会追加去重且不重置 active session', () => {
    const dispatch = vi.fn();
    const sendEnvelope = vi.fn();
    mocks.mapSessionSummary
      .mockReturnValueOnce({ id: 'session-2', updatedAt: '2026-03-27T00:00:00.000Z', kbId: 'kb-1' })
      .mockReturnValueOnce({ id: 'session-3', updatedAt: '2026-03-26T00:00:00.000Z', kbId: 'kb-1' });

    const handlers = createSessionHandlers({
      dispatch,
      sessions: [
        {
          id: 'session-1',
          name: '会话一',
          updatedAt: '2026-03-29T00:00:00.000Z',
          messageCount: 1,
          referenceCount: 0,
          isStreaming: false,
        },
        {
          id: 'session-2',
          name: '会话二',
          updatedAt: '2026-03-28T00:00:00.000Z',
          messageCount: 1,
          referenceCount: 0,
          isStreaming: false,
        },
      ],
      subagentSessionsByParent: {},
      activeSessionId: 'session-1',
      removedSessionIds: {},
      sendEnvelope,
      currentKbId: 'kb-1',
    });

    handlers.handleSessionList({
      append: true,
      sessions: [{ id: 'raw-2' }, { id: 'raw-3' }],
    } as never);

    expect(mocks.setSessions).toHaveBeenCalledWith([
      {
        id: 'session-1',
        name: '会话一',
        updatedAt: '2026-03-29T00:00:00.000Z',
        messageCount: 1,
        referenceCount: 0,
        isStreaming: false,
      },
      {
        id: 'session-2',
        name: '会话二',
        updatedAt: '2026-03-28T00:00:00.000Z',
        messageCount: 1,
        referenceCount: 0,
        isStreaming: false,
      },
      { id: 'session-3', updatedAt: '2026-03-26T00:00:00.000Z', kbId: 'kb-1' },
    ]);
    expect(sendEnvelope).not.toHaveBeenCalled();
    expect(mocks.setActiveSessionId).not.toHaveBeenCalled();
  });

  it('created/renamed/removed/status handler 会派发对应 action', () => {
    const dispatch = vi.fn();
    const handlers = createSessionHandlers({
      dispatch,
      sessions: [
        {
          id: 'session-1',
          name: '旧会话',
          updatedAt: '2026-03-29T00:00:00.000Z',
          messageCount: 3,
          referenceCount: 1,
          isStreaming: false,
        },
      ],
      subagentSessionsByParent: {},
      activeSessionId: 'session-1',
      removedSessionIds: {},
      sendEnvelope: vi.fn(),
      currentKbId: 'kb-1',
    });

    handlers.handleSessionCreated({ agentSessionId: 'session-2', name: '新会话' });
    handlers.handleSessionRenamed({ agentSessionId: 'session-2', name: '新名称', renamed: true });
    handlers.handleSessionRemoved({ agentSessionId: 'session-2', deleted: true });
    handlers.handleSessionStatus({ agentSessionId: 'session-1', exists: true, isStreaming: true });
    handlers.handleSessionStatus({ agentSessionId: 'session-3', exists: false, isStreaming: false });

    expect(mocks.promoteTempSession).toHaveBeenCalledWith({ agentSessionId: 'session-2' });
    expect(mocks.setPendingSessionCreate).toHaveBeenCalledWith(false);
    expect(mocks.removeSession).toHaveBeenCalledWith('session-2');
    expect(mocks.setSessionStatus).toHaveBeenCalledWith({
      agentSessionId: 'session-1',
      status: { exists: true, isStreaming: true },
    });
    expect(mocks.upsertSession).toHaveBeenCalled();
    expect(mocks.removeSession).toHaveBeenCalledWith('session-3');
  });

  it('用户仍停留在临时会话时，created 会切换到新会话', () => {
    const dispatch = vi.fn();
    const handlers = createSessionHandlers({
      dispatch,
      sessions: [],
      subagentSessionsByParent: {},
      activeSessionId: TEMP_SESSION_ID,
      removedSessionIds: {},
      sendEnvelope: vi.fn(),
      currentKbId: 'kb-1',
    });

    handlers.handleSessionCreated({ agentSessionId: 'session-2', name: '新会话' });

    expect(mocks.setActiveSessionId).toHaveBeenCalledWith('session-2');
  });

  it('欢迎页首次建会话时，created 会切换到新会话', () => {
    const dispatch = vi.fn();
    const handlers = createSessionHandlers({
      dispatch,
      sessions: [],
      subagentSessionsByParent: {},
      activeSessionId: null,
      removedSessionIds: {},
      sendEnvelope: vi.fn(),
      currentKbId: 'kb-1',
    });

    handlers.handleSessionCreated({ agentSessionId: 'session-2', name: '新会话' });

    expect(mocks.setActiveSessionId).toHaveBeenCalledWith('session-2');
  });

  it('用户已切到其他会话时，late created 不会抢占当前 active session', () => {
    const dispatch = vi.fn();
    const handlers = createSessionHandlers({
      dispatch,
      sessions: [],
      subagentSessionsByParent: {},
      activeSessionId: 'session-existing',
      removedSessionIds: {},
      sendEnvelope: vi.fn(),
      currentKbId: 'kb-1',
    });

    handlers.handleSessionCreated({ agentSessionId: 'session-2', name: '新会话' });

    expect(mocks.setActiveSessionId).not.toHaveBeenCalled();
    expect(mocks.promoteTempSession).toHaveBeenCalledWith({ agentSessionId: 'session-2' });
    expect(mocks.setPendingSessionCreate).toHaveBeenCalledWith(false);
  });

  it('subagent created 会写入父会话子列表并建立子 session 条目', () => {
    const dispatch = vi.fn();
    const handlers = createSessionHandlers({
      dispatch,
      sessions: [
        {
          id: 'session-parent',
          name: '父会话',
          updatedAt: '2026-03-29T00:00:00.000Z',
          messageCount: 1,
          referenceCount: 0,
          isStreaming: false,
        },
      ],
      subagentSessionsByParent: {},
      activeSessionId: 'session-parent',
      removedSessionIds: {},
      sendEnvelope: vi.fn(),
      currentKbId: 'kb-1',
    });

    handlers.handleSessionCreated({
      agentSessionId: 'agent-sub-1',
      name: 'Explorer',
      sessionType: 'subagent',
      parentSessionId: 'session-parent',
      subagentType: 'explorer',
    });

    expect(mocks.setSubagentSessions).toHaveBeenCalledWith({
      agentSessionId: 'session-parent',
      subagents: [
        {
          sessionId: 'agent-sub-1',
          parentSessionId: 'session-parent',
          subagentType: 'explorer',
          title: 'Explorer',
          status: 'running_foreground',
          updatedAt: '2026-03-29T00:00:00.000Z',
          pendingPermissionCount: 0,
          pendingQuestionCount: 0,
        },
      ],
    });
    expect(mocks.upsertSession).toHaveBeenCalledWith({
      id: 'agent-sub-1',
      name: 'Explorer',
      kbId: null,
      updatedAt: '2026-03-29T00:00:00.000Z',
      sessionType: 'subagent',
      parentSessionId: 'session-parent',
      subagentType: 'explorer',
      status: 'running_foreground',
      messageCount: 0,
      referenceCount: 0,
      isStreaming: false,
      pendingPermissionCount: 0,
      pendingQuestionCount: 0,
    });
    expect(mocks.promoteTempSession).not.toHaveBeenCalled();
    expect(mocks.setActiveSessionId).not.toHaveBeenCalled();
  });

  it('被标记删除的会话不会再更新状态', () => {
    const dispatch = vi.fn();
    const handlers = createSessionHandlers({
      dispatch,
      sessions: [],
      subagentSessionsByParent: {},
      activeSessionId: null,
      removedSessionIds: { 'session-1': true },
      sendEnvelope: vi.fn(),
      currentKbId: 'kb-1',
    });

    handlers.handleSessionStatus({ agentSessionId: 'session-1', exists: true, isStreaming: true });

    expect(mocks.setSessionStatus).not.toHaveBeenCalled();
    expect(mocks.upsertSession).not.toHaveBeenCalled();
  });

  it('subagent session:list 刷新时会保留已知 streaming 状态', () => {
    const dispatch = vi.fn();
    const handlers = createSessionHandlers({
      dispatch,
      sessions: [
        {
          id: 'session-parent',
          name: '父会话',
          updatedAt: '2026-03-29T00:00:00.000Z',
          messageCount: 1,
          referenceCount: 0,
          isStreaming: false,
        },
        {
          id: 'agent-sub-1',
          name: 'Explorer',
          updatedAt: '2026-03-29T00:00:00.000Z',
          messageCount: 0,
          referenceCount: 0,
          isStreaming: true,
          sessionType: 'subagent',
          parentSessionId: 'session-parent',
          subagentType: 'explorer',
        },
      ],
      subagentSessionsByParent: {},
      activeSessionId: 'session-parent',
      removedSessionIds: {},
      sendEnvelope: vi.fn(),
      currentKbId: 'kb-1',
    });

    handlers.handleSessionList({
      parentSessionId: 'session-parent',
      sessionType: 'subagent',
      sessions: [
        {
          agentSessionId: 'agent-sub-1',
          name: 'Explorer',
          updatedAt: '2026-03-29T00:00:00.000Z',
          parentSessionId: 'session-parent',
          subagentType: 'explorer',
        },
      ],
    } as never);

    expect(mocks.upsertSession).toHaveBeenCalledWith({
      id: 'agent-sub-1',
      name: 'Explorer',
      kbId: null,
      updatedAt: '2026-03-29T00:00:00.000Z',
      sessionType: 'subagent',
      parentSessionId: 'session-parent',
      subagentType: 'explorer',
      status: null,
      messageCount: 0,
      referenceCount: 0,
      isStreaming: true,
      pendingPermissionCount: 0,
      pendingQuestionCount: 0,
    });
  });

  it('session:subagent_state 会回写统一 session summary', () => {
    const dispatch = vi.fn();
    const handlers = createSessionHandlers({
      dispatch,
      sessions: [
        {
          id: 'session-parent',
          name: '父会话',
          updatedAt: '2026-03-29T00:00:00.000Z',
          messageCount: 1,
          referenceCount: 0,
          isStreaming: false,
        },
        {
          id: 'agent-sub-1',
          name: 'Explorer',
          updatedAt: '2026-03-29T00:00:00.000Z',
          messageCount: 0,
          referenceCount: 0,
          isStreaming: false,
          sessionType: 'subagent',
          parentSessionId: 'session-parent',
          subagentType: 'explorer',
        },
      ],
      subagentSessionsByParent: {},
      activeSessionId: 'session-parent',
      removedSessionIds: {},
      sendEnvelope: vi.fn(),
      currentKbId: 'kb-1',
    });

    handlers.handleSessionSubagentState?.({
      agentSessionId: 'session-parent',
      subagent: {
        agentId: 'agent-sub-1',
        parentSessionId: 'session-parent',
        subagentType: 'explorer',
        title: 'Explorer',
        status: 'completed',
        updatedAt: '2026-03-29T00:00:00.000Z',
        pendingPermissionCount: 2,
        pendingQuestionCount: 1,
      },
    });

    expect(mocks.upsertSession).toHaveBeenCalledWith({
      id: 'agent-sub-1',
      name: 'Explorer',
      kbId: null,
      updatedAt: '2026-03-29T00:00:00.000Z',
      sessionType: 'subagent',
      parentSessionId: 'session-parent',
      subagentType: 'explorer',
      status: 'completed',
      messageCount: 0,
      referenceCount: 0,
      isStreaming: false,
      pendingPermissionCount: 2,
      pendingQuestionCount: 1,
    });
  });

  it('session:summary_updated 会直接更新统一 session summary', () => {
    const dispatch = vi.fn();
    const handlers = createSessionHandlers({
      dispatch,
      sessions: [],
      subagentSessionsByParent: {},
      activeSessionId: 'session-parent',
      removedSessionIds: {},
      sendEnvelope: vi.fn(),
      currentKbId: 'kb-1',
    });

    handlers.handleSessionSummaryUpdated?.({
      agentSessionId: 'agent-sub-1',
      name: 'Explorer',
      updatedAt: '2026-03-29T00:00:00.000Z',
      sessionType: 'subagent',
      parentSessionId: 'session-parent',
      subagentType: 'explorer',
      status: 'running_foreground',
      isStreaming: true,
      pendingPermissionCount: 1,
      pendingQuestionCount: 2,
    });

    expect(mocks.upsertSession).toHaveBeenCalledWith({
      id: 'agent-sub-1',
      name: 'Explorer',
      kbId: null,
      updatedAt: '2026-03-29T00:00:00.000Z',
      sessionType: 'subagent',
      parentSessionId: 'session-parent',
      subagentType: 'explorer',
      status: 'running_foreground',
      messageCount: 0,
      referenceCount: 0,
      isStreaming: true,
      pendingPermissionCount: 1,
      pendingQuestionCount: 2,
    });
  });

  it('subagent session:list 不会回写主会话列表分页状态', () => {
    const dispatch = vi.fn();
    const onSessionListPage = vi.fn();
    const handlers = createSessionHandlers({
      dispatch,
      sessions: [
        {
          id: 'session-parent',
          name: '父会话',
          updatedAt: '2026-03-29T00:00:00.000Z',
          messageCount: 1,
          referenceCount: 0,
          isStreaming: false,
        },
      ],
      subagentSessionsByParent: {
        'session-parent': [
          {
            sessionId: 'agent-sub-1',
            parentSessionId: 'session-parent',
            subagentType: 'explorer',
            title: 'Explorer',
            status: 'idle',
            updatedAt: '2026-03-29T00:00:00.000Z',
            pendingPermissionCount: 0,
            pendingQuestionCount: 0,
          },
        ],
      },
      activeSessionId: 'session-parent',
      removedSessionIds: {},
      sendEnvelope: vi.fn(),
      currentKbId: 'kb-1',
      onSessionListPage,
    });

    handlers.handleSessionList({
      parentSessionId: 'session-parent',
      sessionType: 'subagent',
      hasMore: false,
      nextCursor: null,
      sessions: [
        {
          agentSessionId: 'agent-sub-1',
          name: 'Explorer',
          updatedAt: '2026-03-29T00:00:00.000Z',
          parentSessionId: 'session-parent',
          subagentType: 'explorer',
        },
      ],
    } as never);

    expect(onSessionListPage).not.toHaveBeenCalled();
  });
});

describe('shouldActivateCreatedSession', () => {
  it('当前仍在欢迎页或临时会话时，created 会自动切换到新会话', () => {
    expect(shouldActivateCreatedSession(TEMP_SESSION_ID)).toBe(true);
    expect(shouldActivateCreatedSession(null)).toBe(true);
    expect(shouldActivateCreatedSession('session-existing')).toBe(false);
  });
});
