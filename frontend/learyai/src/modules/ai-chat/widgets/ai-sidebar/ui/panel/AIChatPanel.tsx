// AIChatPanel 负责提供可嵌入的 AI 聊天面板内容，不承担知识库隔离等状态编排。
import React, { useCallback, useMemo, useState } from 'react';
import { ReadyState } from 'react-use-websocket';
import { resourceApi, type SidebarResource } from '@/modules/kbdoc';
import { useQueryClient } from '@tanstack/react-query';
import SidebarAddResourceModal from './SidebarAddResourceModal';
import SidebarChatInput from './SidebarChatInput';
import SidebarSubagentSwitcher from './SidebarSubagentSwitcher';
import SidebarChatMessages from '../message/SidebarChatMessages';
import SidebarHeader from './SidebarHeader';
import SidebarHistoryView from '../history/SidebarHistoryView';
import { ErrorDialog } from '@leary/ui';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';
import { TourStep } from '@leary/tour-guide';
import type { DocReference } from '../../../../entities';
import type { RenderMessage, RenderUiState } from '../../../../entities/chat/model/view/renderMessage';
import { REPLACED_CONNECTION_MESSAGE, enterTempSession, selectActiveSessionId, selectActiveSessionMessages, selectActiveSessionRenderMessages, selectActiveSessionRenderUiState, selectActiveSessionStatus, selectAiChatAllSessions, selectConnectionStatus, selectPendingSessionCreate } from '../../../../entities';
import { setActiveSessionId, setActiveSessionView, TEMP_SESSION_ID } from '../../../../entities';
import { useScopedSessionView } from '../../../../entities/chat/model/hooks/useScopedSessionView';
import { useAiChatSession } from '../../../../features';
import { isAiChatMockModeEnabled } from '../../../../shared/config/mockMode';

interface AIChatPanelProps {
  resources: SidebarResource[];
  referencedResources: SidebarResource[];
  referencedDocRefs: DocReference[];
  quickPrompts?: string[];
  onToggleReference: (resource: SidebarResource) => void;
  onClearReferences: () => void;
  fallbackDocRef?: DocReference | null;
  projectId?: string;
  kbId?: string;
  isCollapsed?: boolean;
  onToggleCollapsed?: () => void;
  showCollapseToggle?: boolean;
  inputVariant?: 'default' | 'mobile-floating';
}

const RESOURCE_CENTER_GUIDE_TAG = 'guide:resource-center:v1';
const DEFAULT_QUICK_PROMPTS = [
  '介绍一下你能做什么？',
  '请你总结一下当前引用的知识库',
  '当前知识库的大纲是什么？',
];
const EMPTY_RENDER_MESSAGES: RenderMessage[] = [];
const EMPTY_RENDER_UI_STATE: RenderUiState = {
  isStreaming: false,
  statusMessage: null,
  showWaitingRow: false,
  showQuickPromptWelcome: true,
  showTempSkeleton: false,
  showContextSkeleton: false,
  lastTextAssistantId: null,
};

const AIChatPanel: React.FC<AIChatPanelProps> = ({
  resources,
  referencedResources,
  referencedDocRefs,
  quickPrompts = DEFAULT_QUICK_PROMPTS,
  onToggleReference,
  fallbackDocRef = null,
  projectId,
  kbId,
  isCollapsed = false,
  onToggleCollapsed,
  showCollapseToggle = true,
  inputVariant = 'default',
}) => {
  const isMobileFloatingInput = inputVariant === 'mobile-floating';
  const mockModeEnabled = isAiChatMockModeEnabled();
  const [inputText, setInputText] = useState('');
  const [historyState, setHistoryState] = useState<{ kbId?: string; value: boolean }>({
    kbId,
    value: false,
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const allSessions = useAppSelector(selectAiChatAllSessions);
  const activeSessionId = useAppSelector(selectActiveSessionId);
  const messages = useAppSelector(selectActiveSessionMessages);
  const renderMessages = useAppSelector(selectActiveSessionRenderMessages);
  const renderUiState = useAppSelector(selectActiveSessionRenderUiState);
  const sessionStatus = useAppSelector(selectActiveSessionStatus);
  const connectionStatus = useAppSelector(selectConnectionStatus);
  const pendingSessionCreate = useAppSelector(selectPendingSessionCreate);
  const {
    sendQuery,
    cancelQuery,
    respondPermission,
    respondQuestion,
    respondHook,
    respondTool,
    renameSession,
    deleteSession,
    readyState,
    connectionError,
    clearConnectionError,
    reconnect,
    triggerMockReplay,
    sessionListHasMore,
    sessionListLoadingMore,
    loadMoreSessions,
    historyHasMore,
    historyLoadingMore,
    loadMoreHistory,
    activeSessionView,
    activeSubagentSessions,
  } = useAiChatSession(projectId, kbId);

  const { filteredSessions, isActiveSessionVisible } = useScopedSessionView({
    sessions: allSessions,
    activeSessionId,
    kbId,
    dispatch,
  });

  const sessionPendingRequestCountMap = useMemo(
    () =>
      allSessions.reduce<Record<string, number>>((acc, session) => {
        if (session.sessionType === 'subagent') {
          return acc;
        }
        const pendingCount =
          (session.pendingPermissionCount ?? 0) + (session.pendingQuestionCount ?? 0);
        if (pendingCount > 0) {
          acc[session.id] = pendingCount;
        }
        return acc;
      }, {}),
    [allSessions]
  );

  const showHistory = historyState.kbId === kbId ? historyState.value : false;
  const activeSessionSummary = allSessions.find((session) => session.id === activeSessionId) ?? null;
  const visibleSessionId = isActiveSessionVisible
    ? activeSessionView.kind === 'subagent'
      ? activeSessionView.sessionId
      : activeSessionId
    : null;
  const visibleMessages = isActiveSessionVisible ? messages : [];
  const visibleRenderMessages = isActiveSessionVisible ? renderMessages : EMPTY_RENDER_MESSAGES;
  const visibleRenderUiState = isActiveSessionVisible ? renderUiState : EMPTY_RENDER_UI_STATE;
  const visibleSessionStatus = isActiveSessionVisible
    ? sessionStatus
    : { isStreaming: false, exists: false };
  const isTempActive = activeSessionId === TEMP_SESSION_ID;
  const isTempMessageSent = isTempActive && visibleMessages.length > 0;
  const shouldAllowReconnect = connectionStatus.lastError === REPLACED_CONNECTION_MESSAGE;
  const shouldShowReconnectPage = shouldAllowReconnect;
  const shouldShowErrorDialog =
    Boolean(connectionError) && connectionError !== REPLACED_CONNECTION_MESSAGE;
  const isConnectionReady =
    mockModeEnabled || (readyState === ReadyState.OPEN && connectionStatus.status === 'open');
  const errorDialogTitle =
    readyState === ReadyState.OPEN ? '请求失败' : '会话初始化失败';

  const resolvedDocRefs = useMemo(() => {
    if (referencedDocRefs.length > 0) {
      return referencedDocRefs;
    }
    return fallbackDocRef ? [fallbackDocRef] : [];
  }, [fallbackDocRef, referencedDocRefs]);

  const handleSend = () => {
    const content = inputText.trim();
    if (!content) return;
    sendQuery({
      prompt: [{ type: 'text', text: content }],
      docRefs: resolvedDocRefs.length > 0 ? resolvedDocRefs : undefined,
    });
    setInputText('');
  };
  const handleQuickPrompt = useCallback(
    (prompt: string) => {
      const content = prompt.trim();
      if (!content || !isConnectionReady || pendingSessionCreate) return;
      sendQuery({
        prompt: [{ type: 'text', text: content }],
        docRefs: resolvedDocRefs.length > 0 ? resolvedDocRefs : undefined,
      });
    },
    [isConnectionReady, pendingSessionCreate, resolvedDocRefs, sendQuery]
  );
  const handleSaveTextBlock = useCallback(
    async (payload: { text: string }) => {
      if (!projectId) {
        throw new Error('缺少项目ID，无法保存到知识库');
      }
      if (!kbId) {
        throw new Error('缺少知识库ID，无法保存到知识库');
      }
      await resourceApi.importText({
        projectId,
        kbId,
        text: payload.text,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['resource'] }),
        queryClient.invalidateQueries({ queryKey: ['resource', 'options'] }),
      ]);
    },
    [kbId, projectId, queryClient]
  );
  // WARN: 当前仅按 projectId/kbId 是否存在开放“保存”入口，尚未与后端 importText 的 admin/owner 权限约束对齐。
  const canSaveTextToKb = Boolean(projectId && kbId);

  if (isCollapsed) {
    return (
      <div className="flex h-full flex-col items-center py-3 gap-3">
        <TourStep
          tag={RESOURCE_CENTER_GUIDE_TAG}
          order={3}
          title="会话入口"
          content="这里可以新建对话，也可以切换到已有的对话历史。"
          actionLabel="知道了"
        >
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="size-9 flex items-center justify-center rounded-lg border transition-all active:scale-90 bg-slate-50 dark:bg-[#121212] border-slate-100 dark:border-[#2a2a2a] text-slate-400 hover:text-primary"
            aria-label="展开侧栏"
          >
            <MaterialIcon name="chevron_right" className="text-[20px]" />
          </button>
        </TourStep>
        <div className="flex-1 w-full flex flex-col items-center gap-2 overflow-y-auto custom-scrollbar pb-2">
          {filteredSessions.map((session, index) => (
            <button
              key={session.id}
              type="button"
              onClick={() => {
                dispatch(setActiveSessionId(session.id));
                setHistoryState({ kbId, value: false });
                onToggleCollapsed?.();
              }}
              className={`w-10 rounded-lg border px-2 py-2 text-[11px] font-bold flex flex-col items-center gap-1 transition-colors ${
                session.id === activeSessionId
                  ? 'border-primary text-primary bg-primary/10'
                  : 'border-slate-100 dark:border-[#2a2a2a] text-slate-500 dark:text-[#a0a0a0]'
              }`}
              title={session.name}
            >
              {session.isStreaming ? (
                <MaterialIcon name="progress_activity" className="text-[14px] animate-spin" />
              ) : (
                <span>{index + 1}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col">
      <SidebarHeader
        showHistory={showHistory}
        onToggleHistory={() => {
          if (!isConnectionReady) return;
          setHistoryState((prev) => ({ kbId, value: prev.kbId === kbId ? !prev.value : true }));
        }}
        isHistoryDisabled={!isConnectionReady}
        isCollapsed={isCollapsed}
        onToggleCollapsed={() => onToggleCollapsed?.()}
        showCollapseToggle={showCollapseToggle}
      />

      <div className="relative flex flex-1 overflow-hidden">
        {shouldShowReconnectPage ? (
          <div className="flex-1 flex items-center justify-center px-6">
            <div className="w-full max-w-md rounded-3xl border border-rose-200/90 bg-rose-50/90 p-8 text-center shadow-lg shadow-rose-900/10">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-white text-rose-600 shadow-sm">
                <MaterialIcon name="sync_problem" className="text-[26px]" />
              </div>
              <div className="text-[18px] font-semibold text-rose-700">{REPLACED_CONNECTION_MESSAGE}</div>
              <div className="mt-2 text-[13px] text-rose-600/80">
                当前连接已被其他设备替换，请点击下方按钮重新连接。
              </div>
              <button
                type="button"
                className="mt-6 inline-flex items-center justify-center rounded-full bg-rose-600 px-5 py-2 text-[13px] font-semibold text-white shadow-md shadow-rose-600/25 transition-transform active:scale-95"
                onClick={reconnect}
              >
                重新连接
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
              {activeSessionId && activeSessionId !== TEMP_SESSION_ID && !showHistory ? (
                <SidebarSubagentSwitcher
                  sessions={activeSubagentSessions}
                  activeView={activeSessionView}
                  onSelectMain={() => {
                    const parentSessionId = activeSessionSummary?.parentSessionId ?? activeSessionId;
                    if (!parentSessionId) return;
                    dispatch(
                      setActiveSessionView({
                        agentSessionId: parentSessionId,
                        target: { kind: 'main' },
                      })
                    );
                    setHistoryState({ kbId, value: false });
                  }}
                  onSelectSubagent={(sessionId) => {
                    const parentSessionId = activeSessionSummary?.parentSessionId ?? activeSessionId;
                    if (!parentSessionId) return;
                    dispatch(
                      setActiveSessionView({
                        agentSessionId: parentSessionId,
                        target: { kind: 'subagent', sessionId },
                      })
                    );
                    setHistoryState({ kbId, value: false });
                  }}
                />
              ) : null}
              <SidebarChatMessages
                renderMessages={visibleRenderMessages}
                uiState={visibleRenderUiState}
                isHidden={showHistory}
                sessionId={visibleSessionId}
                hasMoreHistory={historyHasMore}
                isHistoryLoading={historyLoadingMore}
                onLoadMoreHistory={loadMoreHistory}
                quickPrompts={quickPrompts}
                onQuickPrompt={handleQuickPrompt}
                isQuickPromptDisabled={!isConnectionReady}
                onPermissionDecision={respondPermission}
                onQuestionSubmit={respondQuestion}
                onHookSubmit={respondHook}
                onToolSubmit={respondTool}
                onSaveTextBlock={canSaveTextToKb ? handleSaveTextBlock : undefined}
              />
              <SidebarHistoryView
                isVisible={showHistory}
                sessions={filteredSessions}
                pendingRequestCountBySessionId={sessionPendingRequestCountMap}
                activeSessionId={activeSessionId}
                currentKbId={kbId}
                isCreateSessionDisabled={pendingSessionCreate}
                hasMore={sessionListHasMore}
                isLoadingMore={sessionListLoadingMore}
                onLoadMore={loadMoreSessions}
                onSelectSession={(sessionId) => {
                  dispatch(setActiveSessionId(sessionId));
                  setHistoryState({ kbId, value: false });
                }}
                onCreateSession={() => {
                  if (pendingSessionCreate) return;
                  dispatch(enterTempSession());
                  setHistoryState({ kbId, value: false });
                }}
                onRenameSession={(sessionId, name) => renameSession(sessionId, name)}
                onDeleteSession={(sessionId) => deleteSession(sessionId)}
              />
            </div>
          </>
        )}
      </div>

      {!shouldShowReconnectPage && !isMobileFloatingInput && (
        <>
          <SidebarChatInput
            inputText={inputText}
            referencedResources={referencedResources.map((resource) => ({
              id: resource.id,
              title: resource.title,
            }))}
            variant={inputVariant}
            onInputChange={setInputText}
            onOpenAddModal={() => setShowAddModal(true)}
            onSend={handleSend}
            onMockReplay={triggerMockReplay}
            onCancel={cancelQuery}
            isStreaming={visibleSessionStatus.isStreaming}
            isSendDisabled={
              !isActiveSessionVisible || isTempMessageSent || pendingSessionCreate || !isConnectionReady
            }
            showMockReplayButton={mockModeEnabled}
          />
        </>
      )}

      {!shouldShowReconnectPage && isMobileFloatingInput ? (
        <div className="shrink-0 px-4 pb-[5.25rem] pt-3">
          <SidebarChatInput
            inputText={inputText}
            referencedResources={referencedResources.map((resource) => ({
              id: resource.id,
              title: resource.title,
            }))}
            variant={inputVariant}
            onInputChange={setInputText}
            onOpenAddModal={() => setShowAddModal(true)}
            onSend={handleSend}
            onMockReplay={triggerMockReplay}
            onCancel={cancelQuery}
            isStreaming={visibleSessionStatus.isStreaming}
            isSendDisabled={
              !isActiveSessionVisible || isTempMessageSent || pendingSessionCreate || !isConnectionReady
            }
            showMockReplayButton={mockModeEnabled}
          />
        </div>
      ) : null}

      {showAddModal ? (
        <SidebarAddResourceModal
          isOpen={showAddModal}
          resources={resources}
          onClose={() => setShowAddModal(false)}
          selectedResourceIds={referencedResources.map((resource) => resource.id)}
          onToggleResource={onToggleReference}
        />
      ) : null}

      <ErrorDialog
        isOpen={shouldShowErrorDialog}
        title={errorDialogTitle}
        message={connectionError ?? '会话连接失败'}
        onConfirm={clearConnectionError}
      />
    </div>
  );
};

export default React.memo(AIChatPanel);
