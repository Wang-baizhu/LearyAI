// state.test.ts 负责验证 AI Chat 选择器在默认态与活跃会话态下的派生结果。
import { describe, expect, it } from 'vitest';

import {
  selectActivePendingPermission,
  selectActiveSessionId,
  selectActiveSessionMessages,
  selectActiveSessionNeedContext,
  selectActiveSessionStatus,
  selectActiveSessionView,
  selectAiChatSessions,
  selectConnectionStatus,
  selectPendingSessionCreate,
  selectRemovedSessionIds,
  selectSessionsLoaded,
} from '../state';
import {
  REPLACED_CONNECTION_MESSAGE,
  selectActiveSessionRenderMessages,
  selectActiveSessionRenderUiState,
} from '../render';

describe('ai chat selectors', () => {
  it('在缺省状态下返回空集合或默认值', () => {
    const state = { aiChat: undefined } as never;

    expect(selectAiChatSessions(state)).toEqual([]);
    expect(selectActiveSessionId(state)).toBeNull();
    expect(selectActiveSessionMessages(state)).toEqual([]);
    expect(selectActiveSessionStatus(state)).toEqual({ isStreaming: false, exists: false });
    expect(selectActiveSessionNeedContext(state)).toBe(false);
    expect(selectActivePendingPermission(state)).toBeUndefined();
    expect(selectPendingSessionCreate(state)).toBe(false);
    expect(selectSessionsLoaded(state)).toBe(false);
    expect(selectRemovedSessionIds(state)).toEqual({});
    expect(selectConnectionStatus(state)).toEqual({ status: 'idle', lastError: undefined });
    expect(selectActiveSessionRenderMessages(state)).toEqual([]);
    expect(selectActiveSessionRenderUiState(state)).toEqual({
      isStreaming: false,
      statusMessage: null,
      showWaitingRow: false,
      showQuickPromptWelcome: false,
      showTempSkeleton: false,
      showContextSkeleton: false,
      lastTextAssistantId: null,
    });
  });

  it('在存在 activeSessionId 时返回当前会话的派生状态', () => {
    const state = {
      aiChat: {
        sessions: [{ id: 'session-1', name: '会话一' }],
        activeSessionId: 'session-1',
        sessionMessages: {
          'session-1': [{ id: 'msg-1', sender: 'assistant', blocks: [] }],
        },
        sessionStatus: {
          'session-1': { exists: true, isStreaming: true },
        },
        isNeedContext: {
          'session-1': false,
        },
        pendingPermissions: {
          'session-1': [{ toolCallId: 'tool-1' }],
        },
        pendingQuestions: {},
        pendingHooks: {},
        pendingTools: {},
        pendingSessionCreate: true,
        sessionsLoaded: true,
        removedSessionIds: { 'session-2': true },
        connection: { status: 'open', lastError: 'old' },
      },
      resourceCenter: {
        docNameMap: { 'doc-1': '需求文档' },
      },
    } as never;

    expect(selectAiChatSessions(state)).toEqual([{ id: 'session-1', name: '会话一' }]);
    expect(selectActiveSessionId(state)).toBe('session-1');
    expect(selectActiveSessionMessages(state)).toEqual([
      { id: 'msg-1', sender: 'assistant', blocks: [] },
    ]);
    expect(selectActiveSessionStatus(state)).toEqual({ exists: true, isStreaming: true });
    expect(selectActiveSessionNeedContext(state)).toBe(false);
    expect(selectActivePendingPermission(state)).toEqual({ toolCallId: 'tool-1' });
    expect(selectPendingSessionCreate(state)).toBe(true);
    expect(selectSessionsLoaded(state)).toBe(true);
    expect(selectRemovedSessionIds(state)).toEqual({ 'session-2': true });
    expect(selectConnectionStatus(state)).toEqual({ status: 'open', lastError: 'old' });
    expect(selectActiveSessionRenderMessages(state)).toEqual([
      { id: 'msg-1', sender: 'assistant', blocks: [] },
      {
        id: 'pending-permission-tool-1',
        sender: 'assistant',
        createdAt: '',
        blocks: [
          {
            kind: 'permission_request',
            key: 'permission-tool-1',
            request: { toolCallId: 'tool-1' },
          },
        ],
      },
    ]);
    expect(selectActiveSessionRenderUiState(state)).toEqual({
      isStreaming: true,
      statusMessage: null,
      showWaitingRow: false,
      showQuickPromptWelcome: false,
      showTempSkeleton: false,
      showContextSkeleton: false,
      lastTextAssistantId: null,
    });
  });

  it('切到子 agent 视图时会读取对应子 session 的消息和状态', () => {
    const state = {
      aiChat: {
        sessions: [
          {
            id: 'session-1',
            name: '父会话',
            updatedAt: '2026-06-29T00:00:00Z',
            messageCount: 0,
            referenceCount: 0,
            isStreaming: false,
          },
          {
            id: 'agent-1',
            name: '修复器',
            updatedAt: '2026-06-29T00:00:00Z',
            messageCount: 0,
            referenceCount: 0,
            isStreaming: true,
            sessionType: 'subagent',
            parentSessionId: 'session-1',
            subagentType: 'coder',
          },
        ],
        activeSessionId: 'session-1',
        activeSessionView: {
          'session-1': { kind: 'subagent', sessionId: 'agent-1' },
        },
        sessionMessages: {
          'session-1': [{ id: 'msg-parent', sender: 'assistant', blocks: [] }],
          'agent-1': [{ id: 'msg-child', sender: 'assistant', blocks: [] }],
        },
        sessionStatus: {
          'session-1': { exists: true, isStreaming: false },
          'agent-1': { exists: true, isStreaming: true },
        },
        isNeedContext: {
          'session-1': false,
        },
        isNeedSubagentContext: {
          'agent-1': false,
        },
        pendingPermissions: {},
        pendingQuestions: {
          'agent-1': [{ requestId: 'question-1', toolCallId: 'tool-1', questions: [] }],
        },
        pendingHooks: {},
        pendingTools: {},
        pendingSessionCreate: false,
        sessionsLoaded: true,
        removedSessionIds: {},
        connection: { status: 'open', lastError: undefined },
      },
      resourceCenter: {
        docNameMap: {},
      },
    } as never;

    expect(selectActiveSessionView(state)).toEqual({ kind: 'subagent', sessionId: 'agent-1' });
    expect(selectActiveSessionMessages(state)).toEqual([
      { id: 'msg-child', sender: 'assistant', blocks: [] },
    ]);
    expect(selectActiveSessionStatus(state)).toEqual({ exists: true, isStreaming: true });
    expect(selectActiveSessionNeedContext(state)).toBe(false);
    expect(selectActivePendingPermission(state)).toBeUndefined();
    expect(selectActiveSessionRenderMessages(state)).toEqual([
      { id: 'msg-child', sender: 'assistant', blocks: [] },
    ]);
  });

  it('会将复杂消息转换为 render model，并派生消息区 UI 状态', () => {
    const state = {
      aiChat: {
        sessions: [],
        activeSessionId: '__temp_session__',
        sessionMessages: {
          __temp_session__: [
            {
              id: 'user-1',
              sender: 'user',
              blocks: [{ type: 'text', text: '继续处理' }],
            },
            {
              id: 'assistant-1',
              sender: 'assistant',
              blocks: [
                { type: 'text', text: '参考([doc-1][2])' },
                {
                  type: 'tool_call',
                  toolCallId: 'tool-1',
                  title: '搜索文档',
                  status: 'succeeded',
                },
                {
                  type: 'tool_result',
                  toolCallId: 'tool-1',
                  result: '命中',
                },
              ],
            },
          ],
        },
        sessionStatus: {
          __temp_session__: { exists: true, isStreaming: true },
        },
        isNeedContext: {},
        pendingPermissions: {},
        pendingQuestions: {},
        pendingHooks: {},
        pendingTools: {},
        pendingSessionCreate: false,
        sessionsLoaded: true,
        removedSessionIds: {},
        connection: { status: 'closed', lastError: undefined },
      },
      resourceCenter: {
        docNameMap: { 'doc-1': '需求文档' },
      },
    } as never;

    expect(selectActiveSessionRenderMessages(state)).toEqual([
      {
        id: 'user-1',
        sender: 'user',
        blocks: [
          {
            kind: 'text',
            key: 'user-1-text-0',
            text: '继续处理',
            copyText: '继续处理',
            saveText: '继续处理',
          },
        ],
      },
      {
        id: 'assistant-1',
        sender: 'assistant',
        blocks: [
          {
            kind: 'text',
            key: 'assistant-1-text-0',
            text: '参考([doc-1][2])',
            copyText: '参考需求文档2页',
            saveText: '参考([doc-1][2])',
          },
          {
            kind: 'tool_group',
            key: 'assistant-1-tool-group-tool-1-1',
            call: {
              type: 'tool_call',
              toolCallId: 'tool-1',
              title: '搜索文档',
              status: 'succeeded',
            },
            result: {
              type: 'tool_result',
              toolCallId: 'tool-1',
              result: '命中',
            },
          },
        ],
      },
    ]);
    expect(selectActiveSessionRenderUiState(state)).toEqual({
      isStreaming: true,
      statusMessage: '连接已断开，正在重试...',
      showWaitingRow: false,
      showQuickPromptWelcome: false,
      showTempSkeleton: false,
      showContextSkeleton: false,
      lastTextAssistantId: 'assistant-1',
    });
  });

  it('会过滤掉主历史列表中的 subagent session', () => {
    const state = {
      aiChat: {
        sessions: [
          { id: 'session-1', name: '主会话', sessionType: 'main' },
          { id: 'sub-1', name: '子会话', sessionType: 'subagent' },
        ],
      },
    } as never;

    expect(selectAiChatSessions(state)).toEqual([
      { id: 'session-1', name: '主会话', sessionType: 'main' },
    ]);
  });

  it('连接被替换时不会生成临时状态消息，并在空会话中显示欢迎态', () => {
    const state = {
      aiChat: {
        sessions: [],
        activeSessionId: '__temp_session__',
        sessionMessages: {
          __temp_session__: [],
        },
        sessionStatus: {
          __temp_session__: { exists: true, isStreaming: false },
        },
        isNeedContext: {},
        pendingPermissions: {},
        pendingQuestions: {},
        pendingHooks: {},
        pendingTools: {},
        pendingSessionCreate: false,
        sessionsLoaded: true,
        removedSessionIds: {},
        connection: { status: 'error', lastError: REPLACED_CONNECTION_MESSAGE },
      },
      resourceCenter: {
        docNameMap: {},
      },
    } as never;

    expect(selectActiveSessionRenderUiState(state)).toEqual({
      isStreaming: false,
      statusMessage: null,
      showWaitingRow: false,
      showQuickPromptWelcome: true,
      showTempSkeleton: false,
      showContextSkeleton: false,
      lastTextAssistantId: null,
    });
  });

  it('非临时空会话在无需补拉上下文时也会显示欢迎态', () => {
    const state = {
      aiChat: {
        sessions: [
          {
            id: 'session-1',
            name: '新会话',
            updatedAt: '2026-03-28T00:00:00.000Z',
            messageCount: 0,
            referenceCount: 0,
            isStreaming: false,
          },
        ],
        activeSessionId: 'session-1',
        sessionMessages: {
          'session-1': [],
        },
        sessionStatus: {
          'session-1': { exists: true, isStreaming: false },
        },
        isNeedContext: {
          'session-1': false,
        },
        pendingPermissions: {},
        pendingQuestions: {},
        pendingHooks: {},
        pendingTools: {},
        pendingSessionCreate: false,
        sessionsLoaded: true,
        removedSessionIds: {},
        connection: { status: 'open', lastError: undefined },
      },
      resourceCenter: {
        docNameMap: {},
      },
    } as never;

    expect(selectActiveSessionRenderUiState(state)).toEqual({
      isStreaming: false,
      statusMessage: null,
      showWaitingRow: false,
      showQuickPromptWelcome: true,
      showTempSkeleton: false,
      showContextSkeleton: false,
      lastTextAssistantId: null,
    });
  });

  it('temp 会话在已有 assistant 回复后不会继续显示 skeleton', () => {
    const state = {
      aiChat: {
        sessions: [],
        activeSessionId: '__temp_session__',
        sessionMessages: {
          __temp_session__: [
            {
              id: 'user-1',
              sender: 'user',
              blocks: [{ type: 'text', text: '问题' }],
            },
            {
              id: 'assistant-1',
              sender: 'assistant',
              blocks: [{ type: 'text', text: '回复' }],
            },
          ],
        },
        sessionStatus: {
          __temp_session__: { exists: true, isStreaming: false },
        },
        isNeedContext: {},
        pendingPermissions: {},
        pendingQuestions: {},
        pendingHooks: {},
        pendingTools: {},
        pendingSessionCreate: false,
        sessionsLoaded: true,
        removedSessionIds: {},
        connection: { status: 'open', lastError: undefined },
      },
      resourceCenter: {
        docNameMap: {},
      },
    } as never;

    expect(selectActiveSessionRenderUiState(state)).toEqual({
      isStreaming: false,
      statusMessage: null,
      showWaitingRow: false,
      showQuickPromptWelcome: false,
      showTempSkeleton: false,
      showContextSkeleton: false,
      lastTextAssistantId: 'assistant-1',
    });
  });

  it('会保持 subagent flow blocks 的原始时序，不会把 update 文本统一挪到工具块后面', () => {
    const state = {
      aiChat: {
        sessions: [],
        activeSessionId: 'session-1',
        sessionMessages: {
          'session-1': [
            {
              id: 'assistant-1',
              sender: 'assistant',
              blocks: [
                {
                  type: 'subagent',
                  name: 'Worker',
                  status: 'begin',
                  text: '执行检查',
                  taskToolCallId: 'task-1',
                },
                {
                  type: 'subagent',
                  name: 'Worker',
                  status: 'update',
                  text: '先检索',
                  taskToolCallId: 'task-1',
                },
                {
                  type: 'tool_call',
                  toolCallId: 'tool-1',
                  title: 'Search',
                  status: 'in_progress',
                  taskToolCallId: 'task-1',
                  subagentName: 'Worker',
                },
                {
                  type: 'subagent',
                  name: 'Worker',
                  status: 'update',
                  text: '再总结',
                  taskToolCallId: 'task-1',
                },
              ],
            },
          ],
        },
        sessionStatus: {
          'session-1': { exists: true, isStreaming: false },
        },
        isNeedContext: {
          'session-1': false,
        },
        pendingPermissions: {},
        pendingQuestions: {},
        pendingHooks: {},
        pendingTools: {},
        pendingSessionCreate: false,
        sessionsLoaded: true,
        removedSessionIds: {},
        connection: { status: 'open', lastError: undefined },
      },
      resourceCenter: {
        docNameMap: {},
      },
    } as never;

    expect(selectActiveSessionRenderMessages(state)).toEqual([
      {
        id: 'assistant-1',
        sender: 'assistant',
        blocks: [
          {
            kind: 'subagent_group',
            key: 'assistant-1-subagent-task-1-0',
            name: 'Worker',
            status: 'update',
            description: '执行检查',
            hasResult: false,
            flowBlocks: [
              {
                kind: 'text',
                key: 'assistant-1-subagent-flow-task-1-text-1',
                text: '先检索',
                copyText: '先检索',
                saveText: '先检索',
              },
              {
                kind: 'tool_call',
                key: 'assistant-1-subagent-flow-task-1-tool-call-2',
                call: {
                  type: 'tool_call',
                  toolCallId: 'tool-1',
                  title: 'Search',
                  status: 'in_progress',
                  taskToolCallId: 'task-1',
                  subagentName: 'Worker',
                },
              },
              {
                kind: 'text',
                key: 'assistant-1-subagent-flow-task-1-text-3',
                text: '再总结',
                copyText: '再总结',
                saveText: '再总结',
              },
            ],
            resultBlocks: [],
          },
        ],
      },
    ]);
  });

  it('只会为 assistant 文本替换 citation copyText，不会改写用户消息原文', () => {
    const state = {
      aiChat: {
        sessions: [],
        activeSessionId: 'session-1',
        sessionMessages: {
          'session-1': [
            {
              id: 'user-1',
              sender: 'user',
              blocks: [{ type: 'text', text: '用户输入 ([doc-1][2])' }],
            },
            {
              id: 'assistant-1',
              sender: 'assistant',
              blocks: [{ type: 'text', text: '参考 ([doc-1][2])' }],
            },
          ],
        },
        sessionStatus: {
          'session-1': { exists: true, isStreaming: false },
        },
        isNeedContext: {
          'session-1': false,
        },
        pendingPermissions: {},
        pendingQuestions: {},
        pendingHooks: {},
        pendingTools: {},
        pendingSessionCreate: false,
        sessionsLoaded: true,
        removedSessionIds: {},
        connection: { status: 'open', lastError: undefined },
      },
      resourceCenter: {
        docNameMap: { 'doc-1': '需求文档' },
      },
    } as never;

    expect(selectActiveSessionRenderMessages(state)).toEqual([
      {
        id: 'user-1',
        sender: 'user',
        blocks: [
          {
            kind: 'text',
            key: 'user-1-text-0',
            text: '用户输入 ([doc-1][2])',
            copyText: '用户输入 ([doc-1][2])',
            saveText: '用户输入 ([doc-1][2])',
          },
        ],
      },
      {
        id: 'assistant-1',
        sender: 'assistant',
        blocks: [
          {
            kind: 'text',
            key: 'assistant-1-text-0',
            text: '参考 ([doc-1][2])',
            copyText: '参考 需求文档2页',
            saveText: '参考 ([doc-1][2])',
          },
        ],
      },
    ]);
  });
});
