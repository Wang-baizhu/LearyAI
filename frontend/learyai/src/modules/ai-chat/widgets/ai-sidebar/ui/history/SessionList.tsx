// SessionList 负责在 AI 侧边栏中展示会话列表弹层，风格与历史视图一致。
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AgentSessionSummary } from '../../../../entities';
import { Modal } from '@leary/ui';
import ContextMenu from '@/shared/ui/ContextMenu';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';

interface SessionListProps {
  isVisible: boolean;
  sessions: AgentSessionSummary[];
  pendingRequestCountBySessionId?: Record<string, number>;
  activeSessionId?: string | null;
  currentKbId?: string;
  isCreateSessionDisabled?: boolean;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onSelectSession?: (sessionId: string) => void;
  onCreateSession?: () => void;
  onRenameSession?: (sessionId: string, name: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  onLoadMore?: () => void;
}

const formatDisplayDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const SessionList: React.FC<SessionListProps> = ({
  isVisible,
  sessions,
  pendingRequestCountBySessionId = {},
  activeSessionId,
  currentKbId,
  isCreateSessionDisabled = false,
  hasMore = false,
  isLoadingMore = false,
  onSelectSession,
  onCreateSession,
  onRenameSession,
  onDeleteSession,
  onLoadMore,
}) => {
  const [menuSessionId, setMenuSessionId] = useState<string | null>(null);
  const [menuAnchorRect, setMenuAnchorRect] = useState<DOMRect | null>(null);
  const [renameSessionId, setRenameSessionId] = useState<string | null>(null);
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [pendingActions, setPendingActions] = useState<
    Map<string, { type: 'rename' | 'delete'; targetName?: string }>
  >(new Map());
  const listRef = useRef<HTMLDivElement | null>(null);
  const sessionItemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const loadRequestedRef = useRef(false);
  const wasVisibleRef = useRef(false);
  const previousActiveSessionIdRef = useRef<string | null | undefined>(activeSessionId);

  const deleteTarget = useMemo(
    () => sessions.find((session) => session.id === deleteSessionId),
    [deleteSessionId, sessions]
  );

  const effectivePendingActions = useMemo(() => {
    if (!pendingActions.size) return pendingActions;
    const next = new Map<string, { type: 'rename' | 'delete'; targetName?: string }>();
    pendingActions.forEach((action, sessionId) => {
      const target = sessions.find((session) => session.id === sessionId);
      if (!target) return;
      if (action.type === 'rename' && action.targetName === target.name) return;
      next.set(sessionId, action);
    });
    return next;
  }, [pendingActions, sessions]);

  const normalizeId = (value?: string | null) => (value?.trim() ? value.trim() : undefined);
  const normalizedCurrentKbId = normalizeId(currentKbId);
  const isLockedSession = (session?: AgentSessionSummary | null) => {
    if (!session) return false;
    const sessionKbId = normalizeId(session.kbId);
    return Boolean(normalizedCurrentKbId && sessionKbId && sessionKbId !== normalizedCurrentKbId);
  };

  useEffect(() => {
    if (!isLoadingMore) {
      loadRequestedRef.current = false;
    }
  }, [isLoadingMore]);

  useEffect(() => {
    const justOpened = isVisible && !wasVisibleRef.current;
    wasVisibleRef.current = isVisible;

    if (!justOpened || !activeSessionId) return;
    const activeElement = sessionItemRefs.current[activeSessionId];
    if (!activeElement) return;
    activeElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeSessionId, isVisible]);

  useEffect(() => {
    if (!isVisible) {
      previousActiveSessionIdRef.current = activeSessionId;
      return;
    }

    const activeChanged = previousActiveSessionIdRef.current !== activeSessionId;
    previousActiveSessionIdRef.current = activeSessionId;

    if (!activeChanged || !activeSessionId) return;

    const activeElement = sessionItemRefs.current[activeSessionId];
    if (!activeElement) return;
    activeElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeSessionId, isVisible]);

  useEffect(() => {
    const container = listRef.current;
    if (!container || !hasMore || isLoadingMore || loadRequestedRef.current) {
      return;
    }
    const remaining = container.scrollHeight - container.clientHeight;
    if (remaining > 32) {
      return;
    }
    loadRequestedRef.current = true;
    onLoadMore?.();
  }, [hasMore, isLoadingMore, onLoadMore, sessions.length]);

  const handleScroll = () => {
    const container = listRef.current;
    if (!container || !hasMore || isLoadingMore || loadRequestedRef.current) {
      return;
    }
    const remaining = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (remaining > 32) {
      return;
    }
    loadRequestedRef.current = true;
    onLoadMore?.();
  };

  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 bg-white dark:bg-[#1a1a1a] z-10 p-6 flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
          <MaterialIcon name="list_alt" className="text-primary" />
          当前会话列表
        </h2>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (isCreateSessionDisabled) return;
              onCreateSession?.();
            }}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-bold transition-colors ${
              isCreateSessionDisabled
                ? 'border-slate-200 dark:border-[#2a2a2a] text-slate-300 dark:text-slate-500 cursor-not-allowed'
                : 'border-slate-200 dark:border-[#2a2a2a] text-slate-500 dark:text-[#a0a0a0] hover:border-primary hover:text-primary'
            }`}
            disabled={isCreateSessionDisabled}
          >
            <MaterialIcon name="add" className="text-[14px]" />
            新增会话
          </button>
        </div>
      </div>
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1"
      >
        {sessions.map((session) => {
          const isLocked = isLockedSession(session);
          const isActive = !isLocked && session.id === activeSessionId;
          const pendingRequestCount =
            pendingRequestCountBySessionId[session.id] ??
            (session.pendingPermissionCount ?? 0) + (session.pendingQuestionCount ?? 0);
          return (
          <div
            key={session.id}
            ref={(node) => {
              sessionItemRefs.current[session.id] = node;
            }}
            className={`group bg-slate-50 dark:bg-[#121212] border rounded-xl p-4 transition-all relative overflow-hidden ${
              isLocked
                ? 'border-slate-200 dark:border-[#2a2a2a] opacity-60 cursor-not-allowed'
                : isActive
                  ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10 cursor-pointer'
                  : 'border-slate-100 dark:border-[#2a2a2a] hover:border-primary hover:shadow-lg cursor-pointer'
            }`}
            onClick={() => {
              if (isLocked) return;
              onSelectSession?.(session.id);
            }}
            role="button"
            tabIndex={isLocked ? -1 : 0}
            aria-disabled={isLocked}
            onKeyDown={(event) => {
              if (isLocked) return;
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelectSession?.(session.id);
              }
            }}
          >
            <div className="flex justify-between items-start gap-3 relative z-10">
              <div className="min-w-0">
                <h3
                  className={`text-sm font-bold mb-1 transition-colors truncate ${
                    isLocked
                      ? 'text-slate-500 dark:text-slate-300'
                      : isActive
                        ? 'text-primary'
                        : 'text-slate-800 dark:text-white group-hover:text-primary'
                  }`}
                >
                  {session.name}
                </h3>
                <div className="mt-1 flex items-center gap-2">
                  <p className="text-[11px] text-slate-400">{formatDisplayDate(session.updatedAt)}</p>
                  {pendingRequestCount > 0 ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                      待处理 {pendingRequestCount}
                    </span>
                  ) : null}
                </div>
                {isLocked && (
                  <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">当前知识库不可进入</p>
                )}
              </div>
              <div className="relative">
                <button
                  type="button"
                  className={`size-8 flex items-center justify-center rounded-lg border transition-colors ${
                    isLocked || session.isStreaming
                      ? 'border-slate-200 dark:border-[#2a2a2a] text-slate-300 dark:text-slate-500 cursor-not-allowed'
                      : 'border-slate-200 dark:border-[#2a2a2a] text-slate-400 hover:text-primary hover:border-primary'
                  }`}
                  onClick={(event) => {
                    if (isLocked || session.isStreaming) return;
                    event.stopPropagation();
                    const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                    setMenuAnchorRect(rect);
                    setMenuSessionId((prev) => (prev === session.id ? null : session.id));
                  }}
                  disabled={isLocked || session.isStreaming}
                >
                  {effectivePendingActions.has(session.id) || session.isStreaming ? (
                    <MaterialIcon name="progress_activity" className="text-[18px] animate-spin" />
                  ) : (
                    <MaterialIcon name="more_horiz" className="text-[18px]" />
                  )}
                </button>
              </div>
            </div>
            <div
              className={`absolute inset-0 transition-opacity ${
                isLocked
                  ? 'opacity-0'
                  : isActive
                    ? 'opacity-100 bg-primary/5'
                    : 'opacity-0 group-hover:opacity-100 bg-primary/5'
              }`}
            ></div>
          </div>
          );
        })}
        {isLoadingMore ? (
          <div className="py-2 text-center text-[11px] text-slate-400">正在加载更早会话...</div>
        ) : null}
      </div>

      <ContextMenu
        isOpen={Boolean(menuSessionId)}
        anchorRect={menuAnchorRect}
        onClose={() => {
          setMenuSessionId(null);
          setMenuAnchorRect(null);
        }}
      >
        <div
          className="w-40 rounded-xl bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] shadow-lg"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-t-xl"
            onClick={() => {
              if (!menuSessionId) return;
              const target = sessions.find((session) => session.id === menuSessionId);
              if (!target || isLockedSession(target)) return;
              setRenameSessionId(target.id);
              setRenameValue(target.name);
              setMenuSessionId(null);
              setMenuAnchorRect(null);
            }}
          >
            <MaterialIcon name="edit" className="text-[18px]" />
            重命名
          </button>
          <button
            type="button"
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-500 hover:bg-rose-50 rounded-b-xl dark:text-rose-300 dark:hover:bg-rose-900/40 transition-colors"
            onClick={() => {
              if (!menuSessionId) return;
              const target = sessions.find((session) => session.id === menuSessionId);
              if (!target || isLockedSession(target)) return;
              setDeleteSessionId(menuSessionId);
              setMenuSessionId(null);
              setMenuAnchorRect(null);
            }}
          >
            <MaterialIcon name="delete" className="text-[18px]" />
            删除
          </button>
        </div>
      </ContextMenu>

      <Modal
        isOpen={Boolean(renameSessionId)}
        title="重命名会话"
        onClose={() => {
          setRenameSessionId(null);
          setRenameValue('');
        }}
      >
        <div className="space-y-4">
          <input
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary"
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            placeholder="请输入会话名称"
          />
          <div className="flex gap-3">
            <button
              type="button"
              className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700"
              onClick={() => {
                setRenameSessionId(null);
                setRenameValue('');
              }}
            >
              取消
            </button>
            <button
              type="button"
              className="flex-1 rounded-xl bg-primary py-2 text-sm font-semibold text-white"
              onClick={() => {
                if (!renameSessionId) return;
                const nextName = renameValue.trim();
                if (!nextName) return;
                setPendingActions((prev) => {
                  const next = new Map(prev);
                  next.set(renameSessionId, { type: 'rename', targetName: nextName });
                  return next;
                });
                onRenameSession?.(renameSessionId, nextName);
                setRenameSessionId(null);
                setRenameValue('');
              }}
            >
              确认
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(deleteSessionId)}
        title="删除会话"
        onClose={() => setDeleteSessionId(null)}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            确认删除“{deleteTarget?.name ?? '该会话'}”吗？此操作不可撤销。
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700"
              onClick={() => setDeleteSessionId(null)}
            >
              取消
            </button>
            <button
              type="button"
              className="flex-1 rounded-xl bg-rose-500 py-2 text-sm font-semibold text-white"
              onClick={() => {
                if (!deleteSessionId) return;
                setPendingActions((prev) => {
                  const next = new Map(prev);
                  next.set(deleteSessionId, { type: 'delete' });
                  return next;
                });
                onDeleteSession?.(deleteSessionId);
                setDeleteSessionId(null);
              }}
            >
              删除
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SessionList;
