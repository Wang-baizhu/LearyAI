// SidebarSubagentSwitcher 负责展示当前主会话及其子会话的悬浮切换导航，不参与历史列表。
import React, { useState } from 'react';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';
import type { SessionViewTarget, SubagentSessionSummary } from '../../../../entities';

interface SidebarSubagentSwitcherProps {
  sessions: SubagentSessionSummary[];
  activeView: SessionViewTarget;
  onSelectMain: () => void;
  onSelectSubagent: (sessionId: string) => void;
}

const getStatusLabel = (status: SubagentSessionSummary['status']) => {
  switch (status) {
    case 'running_foreground':
    case 'running_background':
      return '执行中';
    case 'completed':
      return '已完成';
    case 'failed':
      return '失败';
    case 'killed':
      return '已中止';
    default:
      return '待命';
  }
};

const getCurrentViewLabel = (
  sessions: SubagentSessionSummary[],
  activeView: SessionViewTarget
) => {
  if (activeView.kind === 'main') {
    return '主 Agent';
  }
  return sessions.find((session) => session.sessionId === activeView.sessionId)?.title ?? '子 Agent';
};

const SidebarSubagentSwitcher: React.FC<SidebarSubagentSwitcherProps> = ({
  sessions,
  activeView,
  onSelectMain,
  onSelectSubagent,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const currentViewLabel = getCurrentViewLabel(sessions, activeView);
  const collapsedBadge = activeView.kind === 'main' ? '主' : '子';
  const handleSelectMain = () => {
    onSelectMain();
    setCollapsed(true);
  };
  const handleSelectSubagent = (sessionId: string) => {
    onSelectSubagent(sessionId);
    setCollapsed(true);
  };

  if (sessions.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-x-2 top-0 z-20">
      <div className="pointer-events-auto w-full max-w-[22rem]">
        <div
          className={`rounded-b-2xl p-1.5 ${
            collapsed
              ? 'border-transparent bg-transparent shadow-none backdrop-blur-0'
              : 'border border-t-0 border-slate-200/90 bg-white/95 shadow-lg shadow-slate-900/10 backdrop-blur dark:border-[#2a2a2a] dark:bg-[#111111]/95'
          }`}
        >
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className={`flex w-full items-center rounded-xl text-left transition-colors hover:bg-slate-100/80 dark:hover:bg-[#1b1b1b] ${
              collapsed ? 'gap-1.5 px-2 py-1' : 'gap-2 px-2.5 py-1.5'
            }`}
          >
            {collapsed ? (
              <div className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-[#1b1b1b] dark:text-[#b0b0b0]">
                {collapsedBadge}
              </div>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    当前会话视图
                  </div>
                  <div className="mt-0.5 truncate text-[13px] font-semibold text-slate-700 dark:text-[#f0f0f0]">
                    {currentViewLabel}
                  </div>
                </div>
                <div className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-[#1b1b1b] dark:text-[#b0b0b0]">
                  {collapsedBadge}
                </div>
              </>
            )}
            <MaterialIcon
              name={collapsed ? 'keyboard_arrow_down' : 'keyboard_arrow_up'}
              className="text-[16px] text-slate-500 dark:text-[#b0b0b0]"
            />
          </button>

          {collapsed ? null : (
            <div className="mt-1.5 space-y-2 border-t border-slate-200/80 px-1.5 pb-1.5 pt-2 dark:border-[#2a2a2a]">
              <button
                type="button"
                onClick={handleSelectMain}
                className={`flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left transition-colors ${
                  activeView.kind === 'main'
                    ? 'border-primary/30 bg-primary/10 text-primary'
                    : 'border-slate-200/80 bg-white text-slate-700 hover:border-primary/30 hover:bg-slate-50 dark:border-[#2a2a2a] dark:bg-[#161616] dark:text-[#e6e6e6] dark:hover:bg-[#202020]'
                }`}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">主 Agent</div>
                  <div className="truncate text-[11px] text-slate-400">当前父会话</div>
                </div>
                <div className="ml-3 flex items-center gap-2">
                  {activeView.kind === 'main' ? (
                    <MaterialIcon name="check" className="text-[18px]" />
                  ) : null}
                </div>
              </button>

              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                {sessions.map((session) => {
                  const isActive =
                    activeView.kind === 'subagent' && activeView.sessionId === session.sessionId;
                  return (
                    <button
                      key={session.sessionId}
                      type="button"
                      onClick={() => handleSelectSubagent(session.sessionId)}
                      className={`flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left transition-colors ${
                        isActive
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
                          : 'border-slate-200/80 bg-white text-slate-700 hover:border-emerald-200 hover:bg-slate-50 dark:border-[#2a2a2a] dark:bg-[#161616] dark:text-[#e6e6e6] dark:hover:bg-[#202020]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{session.title}</div>
                        <div className="truncate text-[11px] text-slate-400">
                          {session.subagentType} · {getStatusLabel(session.status)}
                        </div>
                      </div>
                      <div className="ml-3 flex items-center gap-2">
                        {isActive ? <MaterialIcon name="check" className="text-[18px]" /> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SidebarSubagentSwitcher;
