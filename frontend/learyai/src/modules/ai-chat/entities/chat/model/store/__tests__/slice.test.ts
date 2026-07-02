// slice.test.ts 负责覆盖 ai-chat reducer 的核心分支与 action 行为。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import reducer, {
  TEMP_SESSION_ID,
  addMessage,
  addPendingPermission,
  applyNormalizedEvents,
  clearSession,
  enterTempSession,
  promoteTempSession,
  removeSession,
  resetSessionNeedContext,
  resolveFirstPermission,
  resolvePermission,
  setActiveSessionId,
  setConnectionStatus,
  setPendingSessionCreate,
  setSessionMessages,
  setSessionNeedContext,
  setSessionStatus,
  setSessions,
  updateMessageBlocks,
  upsertSession,
} from '../slice';
import type { NormalizedEvent } from '../../types/normalizedEvent';
import type {
  AgentSessionSummary,
  ChatMessage,
  PermissionRequest,
  SessionStatus,
} from '../../types/schema';

type AiChatState = ReturnType<typeof reducer>;

const makeSession = (overrides: Partial<AgentSessionSummary> = {}): AgentSessionSummary => ({
  id: 'session-1',
  name: 'Session 1',
  updatedAt: '2026-03-29T00:00:00.000Z',
  messageCount: 0,
  referenceCount: 0,
  isStreaming: false,
  ...overrides,
});

const makeMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'message-1',
  sender: 'assistant',
  blocks: [{ type: 'text', text: 'hello' }],
  ...overrides,
});

const makePermission = (overrides: Partial<PermissionRequest> = {}): PermissionRequest => ({
  toolCallId: 'tool-1',
  title: 'Need approval',
  description: 'confirm',
  options: ['approve', 'reject'],
  timeout: 30,
  ...overrides,
});

const makeStatus = (overrides: Partial<SessionStatus> = {}): SessionStatus => ({
  isStreaming: false,
  exists: true,
  ...overrides,
});

const reduce = (state: AiChatState | undefined, action: Parameters<typeof reducer>[1]) =>
  reducer(state, action);

describe('aiChat slice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-29T08:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('会处理连接状态、会话列表加载以及 activeSession 校验', () => {
    let state = reduce(undefined, setConnectionStatus({ status: 'error', error: 'boom' }));
    expect(state.connection).toEqual({ status: 'error', lastError: 'boom' });

    state = {
      ...state,
      activeSessionId: 'session-2',
      removedSessionIds: { 'session-1': true, orphan: true },
    };

    state = reduce(
      state,
      setSessions([makeSession(), makeSession({ id: 'session-2', name: 'Session 2' })])
    );

    expect(state.sessionsLoaded).toBe(true);
    expect(state.activeSessionId).toBe('session-2');
    expect(state.removedSessionIds).toEqual({ orphan: true });

    state = reduce(state, setSessions([makeSession()]));
    expect(state.activeSessionId).toBeNull();

    state = reduce({ ...state, activeSessionId: 'session-1' }, setSessions([]));
    expect(state.activeSessionId).toBeNull();
  });

  it('会标记会话需要上下文，并在切入临时会话时清空临时态', () => {
    let state = reduce(undefined, setActiveSessionId('session-1'));
    expect(state.activeSessionId).toBe('session-1');
    expect(state.isNeedContext['session-1']).toBe(true);

    state = reduce(
      state,
      setSessionNeedContext({ agentSessionId: 'session-1', needContext: false })
    );
    state = reduce(state, setActiveSessionId('session-1'));
    state = reduce(state, setActiveSessionId(TEMP_SESSION_ID));
    expect(state.isNeedContext['session-1']).toBe(false);
    expect(state.isNeedContext[TEMP_SESSION_ID]).toBeUndefined();

    state = reduce(
      state,
      addMessage({
        agentSessionId: TEMP_SESSION_ID,
        message: makeMessage({ id: 'temp-message', sender: 'user' }),
      })
    );
    state = reduce(
      state,
      addPendingPermission({
        agentSessionId: TEMP_SESSION_ID,
        request: makePermission({ toolCallId: 'temp-tool' }),
      })
    );
    state = reduce(
      state,
      setSessionNeedContext({ agentSessionId: TEMP_SESSION_ID, needContext: true })
    );
    state = reduce(state, setPendingSessionCreate(true));

    state = reduce(state, enterTempSession());

    expect(state.activeSessionId).toBe(TEMP_SESSION_ID);
    expect(state.pendingSessionCreate).toBe(false);
    expect(state.sessionMessages[TEMP_SESSION_ID]).toBeUndefined();
    expect(state.pendingPermissions[TEMP_SESSION_ID]).toBeUndefined();
    expect(state.sessionStatus[TEMP_SESSION_ID]).toBeUndefined();
    expect(state.isNeedContext[TEMP_SESSION_ID]).toBeUndefined();
  });

  it('会把临时会话迁移到已有会话，并保留目标会话已有状态', () => {
    let state = reduce(undefined, setSessions([makeSession({ id: 'target', name: 'Target' })]));
    state = reduce(state, setActiveSessionId('session-existing'));
    state = reduce(
      state,
      setSessionMessages({
        agentSessionId: 'target',
        messages: [makeMessage({ id: 'target-existing', blocks: [{ type: 'text', text: 'old' }] })],
      })
    );
    state = reduce(
      state,
      addPendingPermission({
        agentSessionId: 'target',
        request: makePermission({ toolCallId: 'target-tool' }),
      })
    );
    state = reduce(
      state,
      setSessionStatus({ agentSessionId: 'target', status: makeStatus({ exists: false }) })
    );
    state = reduce(
      state,
      addMessage({
        agentSessionId: TEMP_SESSION_ID,
        message: makeMessage({ id: 'temp-message', sender: 'user', blocks: [{ type: 'text', text: 'temp' }] }),
      })
    );
    state = reduce(
      state,
      addPendingPermission({
        agentSessionId: TEMP_SESSION_ID,
        request: makePermission({ toolCallId: 'temp-tool' }),
      })
    );

    state = reduce(state, promoteTempSession({ agentSessionId: 'target' }));

    expect(state.activeSessionId).toBe('session-existing');
    expect(state.sessionMessages.target.map((message) => message.id)).toEqual([
      'temp-message',
      'target-existing',
    ]);
    expect(state.pendingPermissions.target.map((item) => item.toolCallId)).toEqual([
      'temp-tool',
      'target-tool',
    ]);
    expect(state.sessionStatus.target).toEqual({ isStreaming: false, exists: false });
    expect(state.isNeedContext.target).toBe(false);
    expect(state.sessionMessages[TEMP_SESSION_ID]).toBeUndefined();
    expect(state.pendingPermissions[TEMP_SESSION_ID]).toBeUndefined();
    expect(state.sessionStatus[TEMP_SESSION_ID]).toBeUndefined();
  });

  it('会把临时会话提升为新会话，并清理 removedSessionIds 标记', () => {
    let state = reduce(undefined, setSessions([makeSession({ id: 'promoted' })]));
    state = reduce(state, setActiveSessionId(TEMP_SESSION_ID));
    state = reduce(state, removeSession('promoted'));
    state = reduce(
      state,
      addMessage({
        agentSessionId: TEMP_SESSION_ID,
        message: makeMessage({ id: 'temp-message', blocks: [{ type: 'text', text: 'draft' }] }),
      })
    );

    state = reduce(state, promoteTempSession({ agentSessionId: 'promoted' }));
    state = reduce(state, promoteTempSession({ agentSessionId: TEMP_SESSION_ID }));

    expect(state.sessions[0]).toMatchObject({
      id: 'promoted',
      name: '新会话',
      isStreaming: false,
    });
    expect(state.removedSessionIds.promoted).toBeUndefined();
    expect(state.activeSessionId).toBe(TEMP_SESSION_ID);
  });

  it('会 upsert/remove 会话并同步清理关联数据', () => {
    let state = reduce(
      undefined,
      setSessions([makeSession(), makeSession({ id: 'session-2', name: 'Session 2' })])
    );
    state = reduce(state, setActiveSessionId('session-1'));
    state = reduce(
      state,
      setSessionMessages({
        agentSessionId: 'session-1',
        messages: [makeMessage({ id: 'message-1' })],
      })
    );
    state = reduce(
      state,
      addPendingPermission({
        agentSessionId: 'session-1',
        request: makePermission({ toolCallId: 'tool-1' }),
      })
    );
    state = reduce(
      state,
      setSessionStatus({ agentSessionId: 'session-1', status: makeStatus() })
    );
    state = reduce(
      state,
      setSessionNeedContext({ agentSessionId: 'session-1', needContext: true })
    );

    state = reduce(state, upsertSession(makeSession({ id: 'session-1', name: 'Renamed' })));
    state = reduce(state, upsertSession(makeSession({ id: 'session-3', name: 'Session 3' })));
    state = reduce(state, removeSession('session-1'));

    expect(state.sessions.map((session) => session.id)).toEqual(['session-3', 'session-2']);
    expect(state.sessions.find((session) => session.id === 'session-1')).toBeUndefined();
    expect(state.activeSessionId).toBe('session-3');
    expect(state.removedSessionIds['session-1']).toBe(true);
    expect(state.sessionMessages['session-1']).toBeUndefined();
    expect(state.pendingPermissions['session-1']).toBeUndefined();
    expect(state.sessionStatus['session-1']).toBeUndefined();
    expect(state.isNeedContext['session-1']).toBeUndefined();
  });

  it('会把子会话的 live 状态与终态同步回父会话子列表', () => {
    let state = reduce(
      undefined,
      setSessions([
        makeSession({ id: 'session-parent', name: 'Parent' }),
        makeSession({
          id: 'agent-1',
          name: 'Coder',
          sessionType: 'subagent',
          parentSessionId: 'session-parent',
          subagentType: 'coder',
        }),
      ])
    );

    state = reduce(
      state,
      applyNormalizedEvents([
        {
          type: 'session.status',
          agentSessionId: 'agent-1',
          status: { exists: true, isStreaming: true },
        },
      ])
    );

    expect(state.subagentSessions['session-parent']).toEqual([
      {
        sessionId: 'agent-1',
        parentSessionId: 'session-parent',
        subagentType: 'coder',
        title: 'Coder',
        status: 'running_foreground',
        updatedAt: '2026-03-29T08:00:00.000Z',
        pendingPermissionCount: 0,
        pendingQuestionCount: 0,
      },
    ]);

    state = reduce(
      state,
      applyNormalizedEvents([
        {
          type: 'session.status',
          agentSessionId: 'agent-1',
          status: { exists: true, isStreaming: false },
        },
        {
          type: 'session.terminalStatus',
          agentSessionId: 'agent-1',
          status: 'killed',
        },
      ])
    );

    expect(state.subagentSessions['session-parent']).toEqual([
      {
        sessionId: 'agent-1',
        parentSessionId: 'session-parent',
        subagentType: 'coder',
        title: 'Coder',
        status: 'killed',
        updatedAt: '2026-03-29T08:00:00.000Z',
        pendingPermissionCount: 0,
        pendingQuestionCount: 0,
      },
    ]);
    expect(state.sessionStatus['agent-1']).toEqual({ exists: true, isStreaming: false });
    expect(state.sessions.find((session) => session.id === 'agent-1')?.isStreaming).toBe(false);
  });

  it('会追加消息并合并已有消息块', () => {
    let state = reduce(
      undefined,
      addMessage({
        agentSessionId: 'session-1',
        message: makeMessage({ id: 'message-1', blocks: [{ type: 'text', text: 'hello' }] }),
      })
    );

    expect(state.sessionStatus['session-1']).toEqual({ isStreaming: false, exists: true });

    state = reduce(
      state,
      updateMessageBlocks({
        agentSessionId: 'session-1',
        blocks: [{ type: 'text', text: ' world' }],
      })
    );
    state = reduce(
      state,
      updateMessageBlocks({
        agentSessionId: 'session-1',
        blocks: [{ type: 'thinking', text: 'new' }],
      })
    );

    expect(state.sessionMessages['session-1'][0]).toMatchObject({
      id: 'message-1',
      blocks: [{ type: 'text', text: 'hello world' }],
      updatedAt: '2026-03-29T08:00:00.000Z',
    });
    expect(state.sessionMessages['session-1'][1]).toMatchObject({
      sender: 'assistant',
      blocks: [{ type: 'thinking', text: 'new' }],
      updatedAt: '2026-03-29T08:00:00.000Z',
    });
    expect(state.sessionMessages['session-1']).toHaveLength(2);
  });

  it('会在 messages.reset 时跳过流式中的已有消息，并在可重置时替换内容', () => {
    let state = reduce(
      undefined,
      setSessionMessages({
        agentSessionId: 'streaming-session',
        messages: [makeMessage({ id: 'keep-me', blocks: [{ type: 'text', text: 'keep' }] })],
      })
    );
    state = reduce(
      state,
      setSessionStatus({
        agentSessionId: 'streaming-session',
        status: makeStatus({ isStreaming: true }),
      })
    );
    state = reduce(
      state,
      setSessionNeedContext({ agentSessionId: 'reset-session', needContext: true })
    );

    const events: NormalizedEvent[] = [
      {
        type: 'messages.reset',
        agentSessionId: 'streaming-session',
        messages: [makeMessage({ id: 'ignored', blocks: [{ type: 'text', text: 'ignored' }] })],
      },
      {
        type: 'messages.reset',
        agentSessionId: 'reset-session',
        messages: [
          makeMessage({
            id: 'message-reset',
            blocks: [
              { type: 'text', text: 'A' },
              { type: 'text', text: 'B' },
            ],
          }),
        ],
      },
    ];

    state = reduce(state, applyNormalizedEvents(events));

    expect(state.sessionMessages['streaming-session']).toEqual([
      makeMessage({ id: 'keep-me', blocks: [{ type: 'text', text: 'keep' }] }),
    ]);
    expect(state.sessionMessages['reset-session']).toEqual([
      makeMessage({ id: 'message-reset', blocks: [{ type: 'text', text: 'AB' }] }),
    ]);
    expect(state.isNeedContext['reset-session']).toBe(false);
    expect(state.sessionStatus['reset-session']).toEqual({ isStreaming: false, exists: true });
  });

  it('会在 messages.prepend 时把更早历史插到顶部，并跳过重复消息', () => {
    let state = reduce(
      undefined,
      setSessionMessages({
        agentSessionId: 'session-1',
        messages: [
          makeMessage({ id: 'existing-1', blocks: [{ type: 'text', text: '当前消息' }] }),
          makeMessage({ id: 'existing-2', blocks: [{ type: 'text', text: '当前回复' }] }),
        ],
      })
    );

    state = reduce(
      state,
      applyNormalizedEvents([
        {
          type: 'messages.prepend',
          agentSessionId: 'session-1',
          messages: [
            makeMessage({ id: 'older-1', sender: 'user', blocks: [{ type: 'text', text: '更早问题' }] }),
            makeMessage({ id: 'existing-1', blocks: [{ type: 'text', text: '重复当前消息' }] }),
          ],
        },
      ])
    );

    expect(state.sessionMessages['session-1']).toEqual([
      makeMessage({
        id: 'older-1',
        sender: 'user',
        blocks: [{ type: 'text', text: '更早问题' }],
      }),
      makeMessage({ id: 'existing-1', blocks: [{ type: 'text', text: '当前消息' }] }),
      makeMessage({ id: 'existing-2', blocks: [{ type: 'text', text: '当前回复' }] }),
    ]);
  });

  it('会在 streaming 的 messages.reset 后按相同文本类型续写最后一条 assistant 消息', () => {
    let state = reduce(
      undefined,
      setSessionStatus({
        agentSessionId: 'streaming-session',
        status: makeStatus({ isStreaming: true }),
      })
    );

    state = reduce(
      state,
      applyNormalizedEvents([
        {
          type: 'messages.reset',
          agentSessionId: 'streaming-session',
          messages: [
            makeMessage({
              id: 'assistant-reset',
              blocks: [{ type: 'text', text: '历史文本' }],
            }),
          ],
        },
        {
          type: 'message.blocks',
          agentSessionId: 'streaming-session',
          blocks: [{ type: 'text', text: '继续输出' }],
        },
      ])
    );

    expect(state.sessionMessages['streaming-session']).toEqual([
      makeMessage({
        id: 'assistant-reset',
        blocks: [{ type: 'text', text: '历史文本继续输出' }],
        updatedAt: '2026-03-29T08:00:00.000Z',
      }),
    ]);
  });

  it('不会因为 session.status 结束流式而立刻清空当前 assistant 锚点', () => {
    let state = reduce(
      undefined,
      setSessionStatus({
        agentSessionId: 'streaming-session',
        status: makeStatus({ isStreaming: true }),
      })
    );

    state = reduce(
      state,
      applyNormalizedEvents([
        {
          type: 'messages.reset',
          agentSessionId: 'streaming-session',
          messages: [
            makeMessage({
              id: 'assistant-reset',
              blocks: [{ type: 'text', text: '历史文本' }],
            }),
          ],
        },
        {
          type: 'session.status',
          agentSessionId: 'streaming-session',
          status: makeStatus({ isStreaming: false }),
        },
        {
          type: 'message.blocks',
          agentSessionId: 'streaming-session',
          blocks: [{ type: 'text', text: '尾部补齐' }],
        },
      ])
    );

    expect(state.sessionMessages['streaming-session']).toEqual([
      makeMessage({
        id: 'assistant-reset',
        blocks: [{ type: 'text', text: '历史文本尾部补齐' }],
        updatedAt: '2026-03-29T08:00:00.000Z',
      }),
    ]);
    expect(state.sessionStatus['streaming-session']).toEqual({ isStreaming: false, exists: true });
  });

  it('会在 streaming 的 messages.reset 后遇到不同类型时拆成新的 assistant 消息', () => {
    let state = reduce(
      undefined,
      setSessionStatus({
        agentSessionId: 'streaming-session',
        status: makeStatus({ isStreaming: true }),
      })
    );

    state = reduce(
      state,
      applyNormalizedEvents([
        {
          type: 'messages.reset',
          agentSessionId: 'streaming-session',
          messages: [
            makeMessage({
              id: 'assistant-reset',
              blocks: [{ type: 'text', text: '历史文本' }],
            }),
          ],
        },
        {
          type: 'message.blocks',
          agentSessionId: 'streaming-session',
          blocks: [{ type: 'thinking', text: '新的思考' }],
        },
      ])
    );

    expect(state.sessionMessages['streaming-session']).toHaveLength(2);
    expect(state.sessionMessages['streaming-session'][0]).toEqual(
      makeMessage({
        id: 'assistant-reset',
        blocks: [{ type: 'text', text: '历史文本' }],
      })
    );
    expect(state.sessionMessages['streaming-session'][1]).toMatchObject({
      sender: 'assistant',
      blocks: [{ type: 'thinking', text: '新的思考' }],
      updatedAt: '2026-03-29T08:00:00.000Z',
    });
  });

  it('会按当前 assistant 锚点合并连续文本增量', () => {
    let state = reduce(
      undefined,
      addMessage({
        agentSessionId: 'session-1',
        message: makeMessage({ id: 'assistant-msg-1', blocks: [{ type: 'text', text: 'hello' }] }),
      })
    );

    state = reduce(
      state,
      applyNormalizedEvents([
        {
          type: 'message.blocks',
          agentSessionId: 'session-1',
          blocks: [{ type: 'text', text: ' world' }],
        },
      ])
    );

    expect(state.sessionMessages['session-1']).toEqual([
      makeMessage({
        id: 'assistant-msg-1',
        blocks: [{ type: 'text', text: 'hello world' }],
        updatedAt: '2026-03-29T08:00:00.000Z',
      }),
    ]);
  });

  it('会在 message.blocks 事件中按 taskToolCallId、toolCallId 或新消息路径更新内容', () => {
    let state = reduce(
      undefined,
      setSessionMessages({
        agentSessionId: 'session-1',
        messages: [
          makeMessage({
            id: 'task-message',
            blocks: [
              {
                type: 'subagent',
                name: 'Worker',
                status: 'begin',
                taskToolCallId: 'task-1',
              },
            ],
          }),
          makeMessage({
            id: 'tool-message',
            blocks: [
              {
                type: 'tool_call',
                toolCallId: 'tool-1',
                title: 'Search',
                status: 'in_progress',
              },
            ],
          }),
        ],
      })
    );

    state = reduce(
      state,
      applyNormalizedEvents([
        {
          type: 'message.blocks',
          agentSessionId: 'session-1',
          blocks: [
            {
              type: 'tool_result',
              toolCallId: 'task-tool',
              result: 'task result',
              taskToolCallId: 'task-1',
            },
          ],
        },
        {
          type: 'message.blocks',
          agentSessionId: 'session-1',
          blocks: [
            {
              type: 'tool_result',
              toolCallId: 'tool-1',
              result: 'done',
              status: 'succeeded',
            },
          ],
        },
        {
          type: 'message.blocks',
          agentSessionId: 'session-1',
          blocks: [
            { type: 'text', text: 'hi' },
            { type: 'text', text: ' there' },
          ],
        },
      ])
    );

    expect(state.sessionMessages['session-1']).toHaveLength(3);
    expect(state.sessionMessages['session-1'][0].id).toBe('task-message');
    expect(state.sessionMessages['session-1'][0].blocks).toEqual([
      {
        type: 'subagent',
        name: 'Worker',
        status: 'begin',
        taskToolCallId: 'task-1',
      },
      {
        type: 'tool_result',
        toolCallId: 'task-tool',
        result: 'task result',
        taskToolCallId: 'task-1',
      },
    ]);
    expect(state.sessionMessages['session-1'][1].blocks).toEqual([
      {
        type: 'tool_call',
        toolCallId: 'tool-1',
        title: 'Search',
        status: 'succeeded',
      },
      {
        type: 'tool_result',
        toolCallId: 'tool-1',
        result: 'done',
        status: 'succeeded',
      },
    ]);
    expect(state.sessionMessages['session-1'][2]).toMatchObject({
      sender: 'assistant',
      blocks: [{ type: 'text', text: 'hi there' }],
      updatedAt: '2026-03-29T08:00:00.000Z',
    });
    expect(state.sessionStatus['session-1']).toEqual({ isStreaming: false, exists: true });
  });

  it('会在 assistant.messageBoundary 后开启新的 assistant 顺序消息', () => {
    let state = reduce(
      undefined,
      addMessage({
        agentSessionId: 'session-1',
        message: makeMessage({ id: 'assistant-1', blocks: [{ type: 'text', text: 'hello' }] }),
      })
    );

    state = reduce(
      state,
      applyNormalizedEvents([
        { type: 'assistant.messageBoundary', agentSessionId: 'session-1' },
        {
          type: 'message.blocks',
          agentSessionId: 'session-1',
          blocks: [{ type: 'text', text: 'new turn' }],
        },
      ])
    );

    expect(state.sessionMessages['session-1']).toHaveLength(2);
    expect(state.sessionMessages['session-1'][0]).toMatchObject({
      id: 'assistant-1',
      blocks: [{ type: 'text', text: 'hello' }],
    });
    expect(state.sessionMessages['session-1'][1]).toMatchObject({
      sender: 'assistant',
      blocks: [{ type: 'text', text: 'new turn' }],
    });
  });

  it('真实子 sessionId 的连续 assistant 文本会稳定合并到同一条消息', () => {
    let state = reduce(
      undefined,
      applyNormalizedEvents([
        {
          type: 'message.blocks',
          agentSessionId: 'agent-1',
          blocks: [{ type: 'text', text: 'hello ' }],
        },
      ])
    );

    state = reduce(
      state,
      applyNormalizedEvents([
        {
          type: 'message.blocks',
          agentSessionId: 'agent-1',
          blocks: [{ type: 'text', text: 'world' }],
        },
      ])
    );

    expect(state.sessionMessages['agent-1']).toHaveLength(1);
    expect(state.sessionMessages['agent-1'][0]).toMatchObject({
      sender: 'assistant',
      blocks: [{ type: 'text', text: 'hello world' }],
    });
  });

  it('会在用户消息到来时清空当前 assistant 锚点，避免跨 turn 续写旧消息', () => {
    let state = reduce(
      undefined,
      addMessage({
        agentSessionId: 'session-1',
        message: makeMessage({ id: 'assistant-1', blocks: [{ type: 'text', text: 'hello' }] }),
      })
    );

    state = reduce(
      state,
      applyNormalizedEvents([
        {
          type: 'message.blocks',
          agentSessionId: 'session-1',
          sender: 'user',
          blocks: [{ type: 'text', text: '新的问题' }],
        },
        {
          type: 'message.blocks',
          agentSessionId: 'session-1',
          blocks: [{ type: 'text', text: '新的回答' }],
        },
      ])
    );

    expect(state.sessionMessages['session-1']).toHaveLength(3);
    expect(state.sessionMessages['session-1'][0]).toMatchObject({
      id: 'assistant-1',
      blocks: [{ type: 'text', text: 'hello' }],
    });
    expect(state.sessionMessages['session-1'][1]).toMatchObject({
      sender: 'user',
      blocks: [{ type: 'text', text: '新的问题' }],
    });
    expect(state.sessionMessages['session-1'][2]).toMatchObject({
      sender: 'assistant',
      blocks: [{ type: 'text', text: '新的回答' }],
    });
  });

  it('会消费 session.status / needContext / permission 事件以及权限 action', () => {
    let state = reduce(undefined, setSessions([makeSession({ id: 'session-1', isStreaming: false })]));

    state = reduce(
      state,
      applyNormalizedEvents([
        {
          type: 'session.status',
          agentSessionId: 'session-1',
          status: makeStatus({ isStreaming: true }),
        },
        {
          type: 'session.needContext',
          agentSessionId: 'session-1',
          needContext: false,
        },
        {
          type: 'permission.request',
          agentSessionId: 'session-1',
          request: makePermission({ toolCallId: 'tool-1' }),
        },
      ])
    );
    state = reduce(
      state,
      addPendingPermission({
        agentSessionId: 'session-1',
        request: makePermission({ toolCallId: 'tool-2' }),
      })
    );
    state = reduce(
      state,
      resolvePermission({ agentSessionId: 'session-1', toolCallId: 'tool-1' })
    );
    state = reduce(state, resolveFirstPermission({ agentSessionId: 'session-1' }));
    state = reduce(
      state,
      setSessionMessages({
        agentSessionId: 'session-1',
        messages: [makeMessage({ id: 'message-1' })],
      })
    );
    state = reduce(
      state,
      setSessionStatus({ agentSessionId: 'session-1', status: makeStatus({ isStreaming: true }) })
    );
    state = reduce(
      state,
      setSessionNeedContext({ agentSessionId: 'session-1', needContext: true })
    );
    state = reduce(state, resetSessionNeedContext());
    state = reduce(state, clearSession('session-1'));

    expect(state.sessions[0].isStreaming).toBe(true);
    expect(state.sessionStatus['session-1']).toBeUndefined();
    expect(state.pendingPermissions['session-1']).toBeUndefined();
    expect(state.sessionMessages['session-1']).toBeUndefined();
    expect(state.isNeedContext['session-1']).toBeUndefined();
  });

  it('会对重复的 pending request 做幂等去重', () => {
    let state = reduce(undefined, setSessions([makeSession({ id: 'session-1' })]));

    state = reduce(
      state,
      applyNormalizedEvents([
        {
          type: 'permission.request',
          agentSessionId: 'session-1',
          request: makePermission({ requestId: 'req-1', toolCallId: 'tool-1' }),
        },
        {
          type: 'permission.request',
          agentSessionId: 'session-1',
          request: makePermission({ requestId: 'req-1', toolCallId: 'tool-1' }),
        },
        {
          type: 'tool.request',
          agentSessionId: 'session-1',
          request: {
            toolCallId: 'tool-x',
            name: 'demo-tool',
          },
        },
        {
          type: 'tool.request',
          agentSessionId: 'session-1',
          request: {
            toolCallId: 'tool-x',
            name: 'demo-tool',
          },
        },
        {
          type: 'question.request',
          agentSessionId: 'session-1',
          request: {
            requestId: 'question-1',
            toolCallId: 'tool-q',
            questions: [],
          },
        },
        {
          type: 'question.request',
          agentSessionId: 'session-1',
          request: {
            requestId: 'question-1',
            toolCallId: 'tool-q',
            questions: [],
          },
        },
        {
          type: 'hook.request',
          agentSessionId: 'session-1',
          request: {
            requestId: 'hook-1',
            hookEvent: 'BeforeToolCall',
            options: ['allow', 'block'],
          },
        },
        {
          type: 'hook.request',
          agentSessionId: 'session-1',
          request: {
            requestId: 'hook-1',
            hookEvent: 'BeforeToolCall',
            options: ['allow', 'block'],
          },
        },
      ] as NormalizedEvent[])
    );

    expect(state.pendingPermissions['session-1']).toHaveLength(1);
    expect(state.pendingTools['session-1']).toHaveLength(1);
    expect(state.pendingQuestions['session-1']).toHaveLength(1);
    expect(state.pendingHooks['session-1']).toHaveLength(1);
  });

  it('会在 processContext 建立 streaming 锚点后，让后续 processUpdate 继续续写同一条 assistant 消息', () => {
    let state = reduce(undefined, setSessions([makeSession({ id: 'session-1', isStreaming: false })]));

    state = reduce(
      state,
      applyNormalizedEvents([
        {
          type: 'session.status',
          agentSessionId: 'session-1',
          status: { exists: true, isStreaming: true },
        },
        {
          type: 'messages.reset',
          agentSessionId: 'session-1',
          messages: [
            {
              id: 'user-1',
              sender: 'user',
              blocks: [{ type: 'text', text: '问题' }],
            },
            {
              id: 'assistant-1',
              sender: 'assistant',
              blocks: [{ type: 'text', text: '首段回答' }],
            },
          ],
        },
      ])
    );

    state = reduce(
      state,
      applyNormalizedEvents([
        {
          type: 'message.blocks',
          agentSessionId: 'session-1',
          sender: 'assistant',
          blocks: [
            {
              type: 'text',
              text: '，继续补充',
            },
          ],
        },
      ])
    );

    expect(state.sessionMessages['session-1']).toHaveLength(2);
    expect(state.sessionMessages['session-1'][0]).toMatchObject({
      sender: 'user',
      blocks: [{ type: 'text', text: '问题' }],
    });
    expect(state.sessionMessages['session-1'][1]).toMatchObject({
      sender: 'assistant',
      blocks: [{ type: 'text', text: '首段回答，继续补充' }],
      updatedAt: '2026-03-29T08:00:00.000Z',
    });
    expect(state.sessionStatus['session-1']).toEqual({ isStreaming: true, exists: true });
  });
});
