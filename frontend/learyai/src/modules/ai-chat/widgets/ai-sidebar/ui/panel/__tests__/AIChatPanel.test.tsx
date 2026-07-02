// AIChatPanel.test.tsx 负责验证知识库隔离后的会话显示与切换行为。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReadyState } from 'react-use-websocket';
import AIChatPanel from '../AIChatPanel';

const mocks = vi.hoisted(() => ({
  tempSessionId: '__temp_session__',
  dispatch: vi.fn(),
  historyViewProps: null as null | {
    isVisible: boolean;
    sessions: Array<{ id: string }>;
    pendingRequestCountBySessionId?: Record<string, number>;
    activeSessionId?: string | null;
    isCreateSessionDisabled?: boolean;
    onCreateSession?: () => void;
  },
  state: {
    sessions: [] as Array<{
      id: string;
      name: string;
      kbId?: string | null;
      updatedAt: string;
      messageCount: number;
      referenceCount: number;
      isStreaming: boolean;
      pendingPermissionCount?: number;
      pendingQuestionCount?: number;
    }>,
    activeSessionId: '__temp_session__' as string | null,
    messages: [] as Array<{ id: string; sender: string; blocks: Array<{ type: string; text: string }> }>,
    renderMessages: [] as Array<{ id: string; sender: string; blocks: unknown[] }>,
    renderUiState: {
      isStreaming: false,
      statusMessage: null as string | null,
      showWaitingRow: false,
      showQuickPromptWelcome: true,
      showTempSkeleton: false,
      showContextSkeleton: false,
      lastTextAssistantId: null as string | null,
    },
    sessionStatus: { isStreaming: false, exists: true },
    needContext: false,
    pendingSessionCreate: false,
    pendingPermissions: {} as Record<string, Array<unknown>>,
    pendingQuestions: {} as Record<string, Array<unknown>>,
    permissionRequest: null as
      | null
      | {
          toolCallId: string;
          requestId?: string;
          title: string;
          description: string;
          options: string[];
          timeout: number;
        },
    connectionStatus: {
      status: 'open',
      lastError: null as string | null,
    },
  },
  sessionApi: {
    createSession: vi.fn(),
    sendQuery: vi.fn(),
    cancelQuery: vi.fn(),
    respondPermission: vi.fn(),
    renameSession: vi.fn(),
    deleteSession: vi.fn(),
    readyState: 1,
    connectionError: null as string | null,
    clearConnectionError: vi.fn(),
    reconnect: vi.fn(),
    triggerMockReplay: vi.fn(),
    debugMockContentBlockReceive: vi.fn(),
    sessionListHasMore: false,
    sessionListLoadingMore: false,
    loadMoreSessions: vi.fn(),
    historyHasMore: false,
    historyLoadingMore: false,
    loadMoreHistory: vi.fn(),
    activeSessionView: { kind: 'main' } as { kind: 'main' } | { kind: 'subagent'; sessionId: string },
    activeSubagentSessions: [] as Array<{
      sessionId: string;
      parentSessionId: string;
      subagentType: string;
      title: string;
      status: 'completed';
      updatedAt: string;
      pendingPermissionCount: number;
      pendingQuestionCount: number;
    }>,
  },
  importText: vi.fn(),
  queryClient: {
    invalidateQueries: vi.fn(),
  },
}));

vi.mock('@/app/store/hooks', () => ({
  useAppDispatch: () => mocks.dispatch,
  useAppSelector: (selector: (state: typeof mocks.state) => unknown) => selector(mocks.state),
}));

vi.mock('../../../../../entities', () => ({
  TEMP_SESSION_ID: mocks.tempSessionId,
  REPLACED_CONNECTION_MESSAGE: '该账号已在其他连接使用，请重新连接',
  enterTempSession: () => ({ type: 'enterTempSession' }),
  setActiveSessionId: (payload: string) => ({ type: 'setActiveSessionId', payload }),
  setActiveSessionView: (payload: unknown) => ({ type: 'setActiveSessionView', payload }),
  selectAiChatAllSessions: (state: typeof mocks.state) => state.sessions,
  selectAiChatSessions: (state: typeof mocks.state) => state.sessions,
  selectAiChatState: () => ({
    pendingPermissions: mocks.state.pendingPermissions,
    pendingQuestions: mocks.state.pendingQuestions,
    subagentSessions: {
      'session-1': mocks.sessionApi.activeSubagentSessions,
    },
  }),
  selectActiveSessionId: (state: typeof mocks.state) => state.activeSessionId,
  selectActiveSessionMessages: (state: typeof mocks.state) => state.messages,
  selectActiveSessionRenderMessages: (state: typeof mocks.state) => state.renderMessages,
  selectActiveSessionRenderUiState: (state: typeof mocks.state) => state.renderUiState,
  selectActiveSessionStatus: (state: typeof mocks.state) => state.sessionStatus,
  selectPendingSessionCreate: (state: typeof mocks.state) => state.pendingSessionCreate,
  selectActivePendingPermission: (state: typeof mocks.state) => state.permissionRequest,
  selectConnectionStatus: (state: typeof mocks.state) => state.connectionStatus,
}));

vi.mock('../../../../../features', () => ({
  useAiChatSession: () => mocks.sessionApi,
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mocks.queryClient,
}));

vi.mock('@/modules/kbdoc', () => ({
  resourceApi: {
    importText: (...args: unknown[]) => mocks.importText(...args),
  },
}));

vi.mock('../SidebarAddResourceModal', () => ({
  default: ({ isOpen, selectedResourceIds }: { isOpen: boolean; selectedResourceIds: string[] }) => (
    <div>
      mock-add-modal:{String(isOpen)}:{selectedResourceIds.length}
    </div>
  ),
}));

vi.mock('../SidebarChatInput', () => ({
  default: ({
    inputText,
    isSendDisabled,
    isStreaming,
    showMockReplayButton,
  }: {
    inputText: string;
    isSendDisabled: boolean;
    isStreaming: boolean;
    showMockReplayButton?: boolean;
  }) => (
    <div>
      mock-chat-input:{inputText}:{String(isSendDisabled)}:{String(isStreaming)}:
      {String(showMockReplayButton)}
    </div>
  ),
}));

vi.mock('../SidebarSubagentSwitcher', () => ({
  default: ({
    sessions,
    activeView,
  }: {
    sessions: Array<{ sessionId: string }>;
    activeView: { kind: 'main' | 'subagent'; sessionId?: string };
  }) => (
    <div>
      mock-subagent-switcher:{activeView.kind}:{activeView.sessionId ?? 'main'}:{sessions.length}
    </div>
  ),
}));

vi.mock('../../message/SidebarChatMessages', () => ({
  default: ({
    sessionId,
    isHidden,
    uiState,
  }: {
    sessionId?: string | null;
    isHidden: boolean;
    uiState: { showQuickPromptWelcome: boolean; statusMessage: string | null };
  }) => (
    <div>
      mock-chat-messages:{sessionId ?? 'none'}:{String(isHidden)}:
      {String(uiState.showQuickPromptWelcome)}:{uiState.statusMessage ?? 'none'}
    </div>
  ),
}));

vi.mock('../SidebarHeader', () => ({
  default: ({
    showHistory,
    isHistoryDisabled,
    showCollapseToggle,
  }: {
    showHistory: boolean;
    isHistoryDisabled: boolean;
    showCollapseToggle: boolean;
  }) => (
    <div>
      mock-sidebar-header:{String(showHistory)}:{String(isHistoryDisabled)}:
      {String(showCollapseToggle)}
    </div>
  ),
}));

vi.mock('../../history/SidebarHistoryView', () => ({
  default: ({
    isVisible,
    sessions,
    pendingRequestCountBySessionId,
    activeSessionId,
    isCreateSessionDisabled,
    onCreateSession,
  }: {
    isVisible: boolean;
    sessions: Array<{ id: string }>;
    pendingRequestCountBySessionId?: Record<string, number>;
    activeSessionId?: string | null;
    isCreateSessionDisabled?: boolean;
    onCreateSession?: () => void;
  }) => (
    (mocks.historyViewProps = {
      isVisible,
      sessions,
      pendingRequestCountBySessionId,
      activeSessionId,
      isCreateSessionDisabled,
      onCreateSession,
    }),
    <div>
      mock-history-view:{String(isVisible)}:{sessions.length}:
      {sessions.map((session) => session.id).join(',')}
    </div>
  ),
}));

vi.mock('@leary/ui', () => ({
  ErrorDialog: ({
    isOpen,
    title,
    message,
  }: {
    isOpen: boolean;
    title: string;
    message: string;
  }) => (isOpen ? <div>{title}:{message}</div> : null),
}));

vi.mock('../../message/StatusCards', () => ({
  PermissionRequestPanel: ({ request }: { request: { title: string } }) => (
    <div>mock-permission-request:{request.title}</div>
  ),
}));

vi.mock('@/shared/ui/icons/MaterialIcon', () => ({
  default: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock('@leary/tour-guide', () => ({
  TourStep: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('AIChatPanel', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    mocks.dispatch.mockClear();
    mocks.historyViewProps = null;
    mocks.state.sessions = [];
    mocks.state.activeSessionId = mocks.tempSessionId;
    mocks.state.messages = [];
    mocks.state.renderMessages = [];
    mocks.state.renderUiState = {
      isStreaming: false,
      statusMessage: null,
      showWaitingRow: false,
      showQuickPromptWelcome: true,
      showTempSkeleton: false,
      showContextSkeleton: false,
      lastTextAssistantId: null,
    };
    mocks.state.sessionStatus = { isStreaming: false, exists: true };
    mocks.state.needContext = false;
    mocks.state.pendingSessionCreate = false;
    mocks.state.permissionRequest = null;
    mocks.state.connectionStatus = { status: 'open', lastError: null };

    mocks.sessionApi.sendQuery.mockClear();
    mocks.sessionApi.createSession.mockClear();
    mocks.sessionApi.cancelQuery.mockClear();
    mocks.sessionApi.respondPermission.mockClear();
    mocks.sessionApi.renameSession.mockClear();
    mocks.sessionApi.deleteSession.mockClear();
    mocks.sessionApi.clearConnectionError.mockClear();
    mocks.sessionApi.reconnect.mockClear();
    mocks.sessionApi.triggerMockReplay.mockClear();
    mocks.sessionApi.debugMockContentBlockReceive.mockClear();
    mocks.sessionApi.loadMoreSessions.mockClear();
    mocks.sessionApi.loadMoreHistory.mockClear();
    mocks.importText.mockClear();
    mocks.queryClient.invalidateQueries.mockClear();
    mocks.sessionApi.readyState = ReadyState.OPEN;
    mocks.sessionApi.connectionError = null;
    mocks.sessionApi.activeSessionView = { kind: 'main' };
    mocks.sessionApi.activeSubagentSessions = [];
  });

  it('renders the collapsed session launcher safely', () => {
    mocks.state.sessions = [
      {
        id: 'session-1',
        name: '第一个会话',
        kbId: 'kb-1',
        updatedAt: '2026-03-28T10:00:00.000Z',
        messageCount: 2,
        referenceCount: 1,
        isStreaming: false,
      },
      {
        id: 'session-2',
        name: '流式会话',
        kbId: 'kb-1',
        updatedAt: '2026-03-28T11:00:00.000Z',
        messageCount: 4,
        referenceCount: 0,
        isStreaming: true,
      },
      {
        id: 'session-3',
        name: '其他知识库会话',
        kbId: 'kb-2',
        updatedAt: '2026-03-28T12:00:00.000Z',
        messageCount: 1,
        referenceCount: 0,
        isStreaming: false,
      },
    ];
    mocks.state.activeSessionId = 'session-1';

    const render = () =>
      renderToStaticMarkup(
        <AIChatPanel
          resources={[]}
          referencedResources={[]}
          referencedDocRefs={[]}
          onToggleReference={vi.fn()}
          onClearReferences={vi.fn()}
          kbId="kb-1"
          isCollapsed
          onToggleCollapsed={vi.fn()}
        />
      );

    expect(render).not.toThrow();
    const markup = render();
    expect(markup).toContain('展开侧栏');
    expect(markup).toContain('第一个会话');
    expect(markup).toContain('progress_activity');
    expect(markup).not.toContain('其他知识库会话');
  });

  it('只向历史列表传递当前知识库的 session，并在 active session 不属于当前 kb 时隐藏旧消息', () => {
    mocks.state.sessions = [
      {
        id: 'session-1',
        name: '当前知识库会话',
        kbId: 'kb-1',
        updatedAt: '2026-03-28T10:00:00.000Z',
        messageCount: 2,
        referenceCount: 1,
        isStreaming: false,
      },
      {
        id: 'session-2',
        name: '旧知识库会话',
        kbId: 'kb-2',
        updatedAt: '2026-03-28T11:00:00.000Z',
        messageCount: 4,
        referenceCount: 0,
        isStreaming: false,
      },
    ];
    mocks.state.activeSessionId = 'session-2';
    mocks.state.renderUiState = {
      ...mocks.state.renderUiState,
      showQuickPromptWelcome: false,
      statusMessage: '旧会话状态',
    };

    const markup = renderToStaticMarkup(
      <AIChatPanel
        resources={[]}
        referencedResources={[]}
        referencedDocRefs={[]}
        onToggleReference={vi.fn()}
        onClearReferences={vi.fn()}
        kbId="kb-1"
      />
    );

    expect(markup).toContain('mock-history-view:false:1:session-1');
    expect(markup).toContain('mock-chat-messages:none:false:true:none');
  });

  it('renders the reconnect page and hides input-specific sections when the socket is replaced', () => {
    mocks.state.activeSessionId = 'session-9';
    mocks.state.permissionRequest = {
      toolCallId: 'tool-1',
      requestId: 'request-1',
      title: '权限确认',
      description: '需要授权',
      options: ['approve'],
      timeout: 30,
    };
    mocks.state.connectionStatus = {
      status: 'closed',
      lastError: '该账号已在其他连接使用，请重新连接',
    };
    mocks.sessionApi.readyState = ReadyState.CLOSED;
    mocks.sessionApi.connectionError = '该账号已在其他连接使用，请重新连接';

    const markup = renderToStaticMarkup(
      <AIChatPanel
        resources={[]}
        referencedResources={[]}
        referencedDocRefs={[]}
        onToggleReference={vi.fn()}
        onClearReferences={vi.fn()}
        kbId="kb-1"
      />
    );

    expect(markup).toContain('该账号已在其他连接使用，请重新连接');
    expect(markup).toContain('重新连接');
    expect(markup).not.toContain('mock-chat-input');
    expect(markup).not.toContain('mock-permission-request');
  });

  it('websocket 已连接时，query 失败弹窗显示为请求失败而不是会话初始化失败', () => {
    mocks.state.connectionStatus = {
      status: 'error',
      lastError: 'Error code: 403 - upstream_error',
    };
    mocks.sessionApi.readyState = ReadyState.OPEN;
    mocks.sessionApi.connectionError = 'Error code: 403 - upstream_error';

    const markup = renderToStaticMarkup(
      <AIChatPanel
        resources={[]}
        referencedResources={[]}
        referencedDocRefs={[]}
        onToggleReference={vi.fn()}
        onClearReferences={vi.fn()}
        kbId="kb-1"
      />
    );

    expect(markup).toContain('请求失败:Error code: 403 - upstream_error');
    expect(markup).not.toContain('会话初始化失败');
  });

  it('在 VITE_AI_CHAT_MOCK_MODE 下即使连接未就绪也允许正常发送', () => {
    vi.stubEnv('VITE_AI_CHAT_MOCK_MODE', 'true');
    mocks.state.activeSessionId = mocks.tempSessionId;
    mocks.state.connectionStatus = { status: 'closed', lastError: null };
    mocks.state.renderUiState.showQuickPromptWelcome = true;
    mocks.sessionApi.readyState = ReadyState.CLOSED;

    const markup = renderToStaticMarkup(
      <AIChatPanel
        resources={[]}
        referencedResources={[]}
        referencedDocRefs={[]}
        onToggleReference={vi.fn()}
        onClearReferences={vi.fn()}
        kbId="kb-1"
      />
    );

    expect(markup).toContain('mock-chat-input::false:false:true');
  });

  it('创建正式会话期间会禁用发送输入', () => {
    mocks.state.pendingSessionCreate = true;

    const markup = renderToStaticMarkup(
      <AIChatPanel
        resources={[]}
        referencedResources={[]}
        referencedDocRefs={[]}
        onToggleReference={vi.fn()}
        onClearReferences={vi.fn()}
        kbId="kb-1"
      />
    );

    expect(markup).toContain('mock-chat-input::true:false:false');
  });

  it('切到子 agent 视角时显示顶部切换器', () => {
    mocks.state.sessions = [
      {
        id: 'session-1',
        name: '父会话',
        kbId: 'kb-1',
        updatedAt: '2026-06-29T00:00:00Z',
        messageCount: 1,
        referenceCount: 0,
        isStreaming: true,
      },
      {
        id: 'agent-1',
        name: '修复器',
        updatedAt: '2026-06-29T00:00:00Z',
        messageCount: 0,
        referenceCount: 0,
        isStreaming: false,
        sessionType: 'subagent',
        parentSessionId: 'session-1',
      } as typeof mocks.state.sessions[number],
    ];
    mocks.state.activeSessionId = 'session-1';
    mocks.sessionApi.activeSessionView = { kind: 'subagent', sessionId: 'agent-1' };
    mocks.sessionApi.activeSubagentSessions = [
      {
        sessionId: 'agent-1',
        parentSessionId: 'session-1',
        subagentType: 'coder',
        title: '修复器',
        status: 'completed',
        updatedAt: '2026-06-29T00:00:00Z',
        pendingPermissionCount: 1,
        pendingQuestionCount: 0,
      },
    ];

    const markup = renderToStaticMarkup(
      <AIChatPanel
        resources={[]}
        referencedResources={[]}
        referencedDocRefs={[]}
        onToggleReference={vi.fn()}
        onClearReferences={vi.fn()}
        kbId="kb-1"
      />
    );

    expect(markup).toContain('mock-subagent-switcher:subagent:agent-1:1');
    expect(markup).toContain('mock-chat-messages:agent-1:false:true:none');
  });

  it('当前会话视图切换条不再展示待处理数', () => {
    mocks.state.sessions = [
      {
        id: 'session-1',
        name: '父会话',
        kbId: 'kb-1',
        updatedAt: '2026-06-29T00:00:00Z',
        messageCount: 1,
        referenceCount: 0,
        isStreaming: false,
      } as typeof mocks.state.sessions[number],
      {
        id: 'agent-1',
        name: '修复器',
        updatedAt: '2026-06-29T00:00:00Z',
        messageCount: 0,
        referenceCount: 0,
        isStreaming: false,
        sessionType: 'subagent',
        parentSessionId: 'session-1',
      } as typeof mocks.state.sessions[number],
    ];
    mocks.state.activeSessionId = 'session-1';
    mocks.sessionApi.activeSessionView = { kind: 'main' };
    mocks.sessionApi.activeSubagentSessions = [
      {
        sessionId: 'agent-1',
        parentSessionId: 'session-1',
        subagentType: 'coder',
        title: '修复器',
        status: 'completed',
        updatedAt: '2026-06-29T00:00:00Z',
        pendingPermissionCount: 0,
        pendingQuestionCount: 0,
      },
    ];

    const markup = renderToStaticMarkup(
      <AIChatPanel
        resources={[]}
        referencedResources={[]}
        referencedDocRefs={[]}
        onToggleReference={vi.fn()}
        onClearReferences={vi.fn()}
        kbId="kb-1"
      />
    );

    expect(markup).toContain('mock-subagent-switcher:main:main:1');
    expect(markup).not.toContain('待处理');
  });

  it('历史列表只读取主 session 的待处理数', () => {
    mocks.state.sessions = [
      {
        id: 'session-1',
        name: '父会话',
        kbId: 'kb-1',
        updatedAt: '2026-06-29T00:00:00Z',
        messageCount: 1,
        referenceCount: 0,
        isStreaming: false,
        pendingPermissionCount: 2,
        pendingQuestionCount: 1,
      },
      {
        id: 'agent-1',
        name: '修复器',
        updatedAt: '2026-06-29T00:00:00Z',
        messageCount: 0,
        referenceCount: 0,
        isStreaming: false,
        sessionType: 'subagent',
        parentSessionId: 'session-1',
        pendingPermissionCount: 5,
        pendingQuestionCount: 6,
      } as typeof mocks.state.sessions[number],
    ];
    mocks.state.activeSessionId = 'session-1';
    mocks.sessionApi.activeSubagentSessions = [
      {
        sessionId: 'agent-1',
        parentSessionId: 'session-1',
        subagentType: 'coder',
        title: '修复器',
        status: 'completed',
        updatedAt: '2026-06-29T00:00:00Z',
        pendingPermissionCount: 2,
        pendingQuestionCount: 1,
      },
    ];

    renderToStaticMarkup(
      <AIChatPanel
        resources={[]}
        referencedResources={[]}
        referencedDocRefs={[]}
        onToggleReference={vi.fn()}
        onClearReferences={vi.fn()}
        kbId="kb-1"
      />
    );

    expect(mocks.historyViewProps?.pendingRequestCountBySessionId).toEqual({
      'session-1': 3,
    });
  });

  it('不会把子 session 的待处理数再次叠加到父会话历史列表', () => {
    mocks.state.sessions = [
      {
        id: 'session-1',
        name: '父会话',
        kbId: 'kb-1',
        updatedAt: '2026-06-29T00:00:00Z',
        messageCount: 1,
        referenceCount: 0,
        isStreaming: false,
        pendingPermissionCount: 1,
        pendingQuestionCount: 2,
      } as typeof mocks.state.sessions[number],
      {
        id: 'agent-1',
        name: '修复器',
        updatedAt: '2026-06-29T00:00:00Z',
        messageCount: 0,
        referenceCount: 0,
        isStreaming: false,
        sessionType: 'subagent',
        parentSessionId: 'session-1',
        pendingPermissionCount: 2,
        pendingQuestionCount: 1,
      } as typeof mocks.state.sessions[number],
    ];
    mocks.state.activeSessionId = 'session-1';

    renderToStaticMarkup(
      <AIChatPanel
        resources={[]}
        referencedResources={[]}
        referencedDocRefs={[]}
        onToggleReference={vi.fn()}
        onClearReferences={vi.fn()}
        kbId="kb-1"
      />
    );

    expect(mocks.historyViewProps?.pendingRequestCountBySessionId).toEqual({
      'session-1': 3,
    });
  });

  it('点击新增会话时切回临时会话而不是直接创建持久化会话', () => {
    renderToStaticMarkup(
      <AIChatPanel
        resources={[]}
        referencedResources={[]}
        referencedDocRefs={[]}
        onToggleReference={vi.fn()}
        onClearReferences={vi.fn()}
        kbId="kb-1"
      />
    );

    expect(mocks.historyViewProps?.onCreateSession).toBeTypeOf('function');

    mocks.historyViewProps?.onCreateSession?.();

    expect(mocks.dispatch).toHaveBeenCalledWith({ type: 'enterTempSession' });
    expect(mocks.sessionApi.createSession).not.toHaveBeenCalled();
  });

  it('向历史列表透传当前 active session id', () => {
    mocks.state.activeSessionId = 'session-1';
    mocks.state.sessions = [
      {
        id: 'session-1',
        name: '当前知识库会话',
        kbId: 'kb-1',
        updatedAt: '2026-03-28T10:00:00.000Z',
        messageCount: 2,
        referenceCount: 1,
        isStreaming: false,
      },
    ];

    renderToStaticMarkup(
      <AIChatPanel
        resources={[]}
        referencedResources={[]}
        referencedDocRefs={[]}
        onToggleReference={vi.fn()}
        onClearReferences={vi.fn()}
        kbId="kb-1"
      />
    );

    expect(mocks.historyViewProps?.activeSessionId).toBe('session-1');
  });

  it('创建正式会话期间禁用新增会话入口', () => {
    mocks.state.pendingSessionCreate = true;

    renderToStaticMarkup(
      <AIChatPanel
        resources={[]}
        referencedResources={[]}
        referencedDocRefs={[]}
        onToggleReference={vi.fn()}
        onClearReferences={vi.fn()}
        kbId="kb-1"
      />
    );

    expect(mocks.historyViewProps?.isCreateSessionDisabled).toBe(true);

    mocks.historyViewProps?.onCreateSession?.();

    expect(mocks.dispatch).not.toHaveBeenCalledWith({ type: 'enterTempSession' });
  });
});
