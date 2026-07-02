// SidebarChatMessages 负责展示消息流与流式加载状态。
import React, { useCallback, useEffect, useRef } from 'react';
import type { RenderMessage, RenderUiState } from '../../../../entities';
import MessageRoleRenderer from './MessageRoleRenderer';
import SkeletonLoader from '@/shared/ui/SkeletonLoader';

interface SidebarChatMessagesProps {
  renderMessages: RenderMessage[];
  uiState: RenderUiState;
  isHidden: boolean;
  bottomInset?: number;
  sessionId?: string | null;
  hasMoreHistory?: boolean;
  isHistoryLoading?: boolean;
  onLoadMoreHistory?: () => void;
  quickPrompts?: string[];
  onQuickPrompt?: (prompt: string) => void;
  isQuickPromptDisabled?: boolean;
  onPermissionDecision?: (payload: {
    toolCallId: string;
    requestId?: string;
    decision: 'approve' | 'reject' | 'approve_for_session';
  }) => void;
  onQuestionSubmit?: (payload: { requestId: string; answers: Record<string, string> }) => void;
  onHookSubmit?: (payload: { requestId: string; action: 'allow' | 'block'; reason?: string }) => void;
  onToolSubmit?: (payload: {
    toolCallId: string;
    output: string;
    isError?: boolean;
    message?: string;
  }) => void;
  onSaveTextBlock?: (payload: { text: string }) => Promise<void> | void;
}

const SidebarChatMessages: React.FC<SidebarChatMessagesProps> = (props) => {
  const {
    renderMessages,
    uiState,
    isHidden,
    bottomInset = 0,
    sessionId,
    hasMoreHistory = false,
    isHistoryLoading = false,
    onLoadMoreHistory,
    quickPrompts = [],
    onQuickPrompt,
    isQuickPromptDisabled = false,
    onPermissionDecision,
    onQuestionSubmit,
    onHookSubmit,
    onToolSubmit,
    onSaveTextBlock,
  } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const autoScrollEnabledRef = useRef(true);
  const interruptCountRef = useRef(0);
  const lastScrollTopRef = useRef(0);
  const bottomOffsetRef = useRef<HTMLDivElement | null>(null);
  const bottomThreshold = 6;
  const topThreshold = 24;
  const pendingHistoryOffsetRef = useRef<number | null>(null);
  const historyLoadRequestedRef = useRef(false);

  const triggerLoadMoreHistory = useCallback(() => {
    const container = containerRef.current;
    if (
      !container ||
      !hasMoreHistory ||
      isHistoryLoading ||
      historyLoadRequestedRef.current ||
      !onLoadMoreHistory
    ) {
      return;
    }
    pendingHistoryOffsetRef.current = container.scrollHeight - container.scrollTop;
    historyLoadRequestedRef.current = true;
    onLoadMoreHistory();
  }, [hasMoreHistory, isHistoryLoading, onLoadMoreHistory]);

  const isAtBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return true;
    const remaining =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    return remaining <= bottomThreshold;
  }, []);

  const scrollToBottom = useCallback(() => {
    if (bottomOffsetRef.current) {
      bottomOffsetRef.current.scrollIntoView({ block: 'end' });
    } else if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, []);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const currentTop = container.scrollTop;
    if (currentTop <= topThreshold) {
      triggerLoadMoreHistory();
    }
    const scrolledUp = currentTop < lastScrollTopRef.current;
    lastScrollTopRef.current = currentTop;

    if (isAtBottom()) {
      autoScrollEnabledRef.current = true;
      interruptCountRef.current = 0;
      return;
    }

    if (scrolledUp) {
      interruptCountRef.current += 1;
      if (interruptCountRef.current >= 2) {
        autoScrollEnabledRef.current = false;
      }
    }
  }, [isAtBottom, topThreshold, triggerLoadMoreHistory]);

  useEffect(() => {
    autoScrollEnabledRef.current = true;
    interruptCountRef.current = 0;
    lastScrollTopRef.current = 0;
    scrollToBottom();
  }, [scrollToBottom, sessionId]);

  useEffect(() => {
    if (!autoScrollEnabledRef.current) return;
    scrollToBottom();
  }, [renderMessages, scrollToBottom, uiState.statusMessage]);

  useEffect(() => {
    if (isHistoryLoading) {
      return;
    }
    historyLoadRequestedRef.current = false;
    const container = containerRef.current;
    if (!container || pendingHistoryOffsetRef.current === null) {
      return;
    }
    container.scrollTop = Math.max(container.scrollHeight - pendingHistoryOffsetRef.current, 0);
    pendingHistoryOffsetRef.current = null;
  }, [isHistoryLoading, renderMessages, uiState.statusMessage]);

  useEffect(() => {
    const container = containerRef.current;
    if (
      !container ||
      !hasMoreHistory ||
      isHistoryLoading ||
      historyLoadRequestedRef.current ||
      !onLoadMoreHistory
    ) {
      return;
    }
    const remaining = container.scrollHeight - container.clientHeight;
    if (remaining > topThreshold) {
      return;
    }
    pendingHistoryOffsetRef.current = container.scrollHeight - container.scrollTop;
    historyLoadRequestedRef.current = true;
    onLoadMoreHistory();
  }, [
    hasMoreHistory,
    isHistoryLoading,
    onLoadMoreHistory,
    renderMessages.length,
    sessionId,
    topThreshold,
    uiState.statusMessage,
  ]);

  useEffect(() => {
    if (renderMessages.length > 0 || uiState.statusMessage) return;
    const container = containerRef.current;
    if (!container) return;
    container.scrollTop = 0;
    autoScrollEnabledRef.current = true;
    interruptCountRef.current = 0;
    lastScrollTopRef.current = 0;
  }, [renderMessages.length, sessionId, uiState.statusMessage]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={`flex-1 overflow-y-auto px-5 py-6 space-y-5 custom-scrollbar transition-opacity duration-300 ${
        isHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{ paddingBottom: `calc(1.5rem + ${bottomInset}px)` }}
    >
      <div className="space-y-4">
        {uiState.showQuickPromptWelcome && quickPrompts.length > 0 ? (
          <div className="flex flex-col items-center justify-start px-1 py-2">
            <h2 className="mb-6 text-[28px] font-semibold tracking-tight text-slate-900 dark:text-white">
              欢迎使用 learyAI
            </h2>
            <div className="flex max-w-3xl flex-wrap items-center justify-center gap-2.5">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={isQuickPromptDisabled}
                  onClick={() => onQuickPrompt?.(prompt)}
                  className="rounded-2xl border border-slate-200/80 bg-slate-100/90 px-4 py-2 text-[13px] text-slate-800 transition-colors hover:bg-slate-200/90 dark:border-[#2a2a2a] dark:bg-[#161616] dark:text-[#e0e0e0] dark:hover:bg-[#1f1f1f] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {renderMessages.map((message) => (
          <MessageRoleRenderer
            key={message.id}
            message={message}
            isStreaming={uiState.isStreaming}
            isLastTextAssistant={message.id === uiState.lastTextAssistantId}
            onPermissionDecision={onPermissionDecision}
            onQuestionSubmit={onQuestionSubmit}
            onHookSubmit={onHookSubmit}
            onToolSubmit={onToolSubmit}
            onSaveTextBlock={onSaveTextBlock}
          />
        ))}
        {uiState.statusMessage ? (
          <div className="w-full py-1">
            <div className="flex items-center gap-3 text-[12px] font-medium text-slate-500 dark:text-slate-400">
              <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700/70" />
              <span className="shrink-0 tracking-wide">{uiState.statusMessage}</span>
              <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700/70" />
            </div>
          </div>
        ) : null}
        {uiState.showWaitingRow ? (
          <div className="flex items-start">
            <img
              src="/waiting.svg"
              alt="AI 正在等待下一条消息"
              className="h-6 w-[72px]"
              loading="eager"
              decoding="async"
            />
          </div>
        ) : null}
        {uiState.showTempSkeleton ? (
          <SkeletonLoader
            barCount={6}
            maxWidths={['92%', '68%', '58%', '72%', '40%', '28%']}
            delayBase={110}
            speed={0.9}
          />
        ) : null}
        {uiState.showContextSkeleton ? (
          <SkeletonLoader
            barCount={7}
            maxWidths={['88%', '62%', '46%', '70%', '52%', '34%', '22%']}
            delayBase={140}
            speed={1.1}
          />
        ) : null}
        <div ref={bottomOffsetRef} />
      </div>
    </div>
  );
};

export default SidebarChatMessages;
