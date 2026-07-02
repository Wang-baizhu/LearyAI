// SubagentActivity 负责展示子 agent 的任务状态、描述与折叠内容区。
import React, { useMemo, useState } from 'react';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';

interface SubagentActivityProps {
  name: string;
  status: 'begin' | 'update' | 'end';
  description?: string;
  hasResult: boolean;
  flowChildren?: React.ReactNode;
  resultChildren?: React.ReactNode;
}

const SubagentActivity: React.FC<SubagentActivityProps> = ({
  name,
  status,
  description,
  hasResult,
  flowChildren,
  resultChildren,
}) => {
  const [isOpen, setIsOpen] = useState(() => status !== 'end');
  const [manualActiveTab, setManualActiveTab] = useState<'flow' | 'result' | null>(null);
  const statusLabel = useMemo(() => {
    const isExplorer = name === 'explorer';
    if (status === 'end') return isExplorer ? '已探索完成' : '已完成';
    return isExplorer ? '正在探索中...' : '正在执行中...';
  }, [name, status]);

  const activeTab = manualActiveTab ?? (status === 'end' ? 'result' : 'flow');

  return (
    <div className="rounded-xl border border-emerald-100/80 dark:border-[#2a2a2a] bg-emerald-50/40 dark:bg-[#101010] px-3 py-2 shadow-sm">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-start justify-between gap-3 text-left"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-emerald-600 dark:text-emerald-300 text-[12px] font-semibold">
              {statusLabel}
            </span>
            {name && name !== 'explorer' && (
              <span className="text-[10px] uppercase tracking-widest text-slate-400">
                {name}
              </span>
            )}
          </div>
          {description && (
            <div className="text-[11px] text-slate-500 dark:text-[#a0a0a0]">
              {description}
            </div>
          )}
        </div>
        <MaterialIcon
          name={isOpen ? 'expand_less' : 'expand_more'}
          className="text-[18px] text-slate-500 dark:text-[#a0a0a0]"
        />
      </button>
      {isOpen && (
        <div className="mt-2 space-y-2 pl-3 border-l border-emerald-100/80 dark:border-[#2a2a2a] text-[12px] text-slate-600 dark:text-[#e0e0e0]">
          <div className="flex items-center gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => setManualActiveTab('flow')}
              className={`px-2.5 py-1 rounded-full border transition-colors ${
                activeTab === 'flow'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white/80 dark:bg-[#1a1a1a] text-slate-500 border-slate-200/70 dark:border-[#2a2a2a]'
              }`}
            >
              流程
            </button>
            <button
              type="button"
              onClick={() => setManualActiveTab('result')}
              className={`px-2.5 py-1 rounded-full border transition-colors ${
                activeTab === 'result'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white/80 dark:bg-[#1a1a1a] text-slate-500 border-slate-200/70 dark:border-[#2a2a2a]'
              }`}
            >
              结果
            </button>
          </div>
          <div>
            {activeTab === 'flow'
              ? flowChildren
              : hasResult
              ? resultChildren
              : <div className="text-slate-400">暂无结果</div>}
          </div>
        </div>
      )}
    </div>
  );
};

export default SubagentActivity;
