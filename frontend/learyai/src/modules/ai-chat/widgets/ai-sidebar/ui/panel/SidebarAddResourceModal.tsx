// SidebarAddResourceModal 负责展示可引用资源列表并处理选择逻辑。
import React from 'react';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';
import type { SidebarResource } from '@/modules/kbdoc';

interface SidebarAddResourceModalProps {
  isOpen: boolean;
  resources: SidebarResource[];
  onClose: () => void;
  selectedResourceIds: string[];
  onToggleResource: (resource: SidebarResource) => void;
}

const SidebarAddResourceModal: React.FC<SidebarAddResourceModalProps> = ({
  isOpen,
  resources,
  onClose,
  selectedResourceIds,
  onToggleResource,
}) => {
  const [keyword, setKeyword] = React.useState('');

  if (!isOpen) return null;

  const normalizedKeyword = keyword.trim().toLowerCase();
  const visibleResources = resources.filter((res) =>
    normalizedKeyword ? res.title.toLowerCase().includes(normalizedKeyword) : true,
  );
  const selectableResources = visibleResources.filter(
    (res) => res.status === undefined || res.status === 'DONE',
  );
  const selectedSelectableCount = selectableResources.filter((res) =>
    selectedResourceIds.includes(res.id),
  ).length;
  const allSelected = selectableResources.length > 0 && selectedSelectableCount === selectableResources.length;

  const handleToggleAll = () => {
    if (selectableResources.length === 0) return;
    if (allSelected) {
      selectableResources.forEach((res) => {
        if (selectedResourceIds.includes(res.id)) onToggleResource(res);
      });
      return;
    }
    selectableResources.forEach((res) => {
      if (!selectedResourceIds.includes(res.id)) onToggleResource(res);
    });
  };

  return (
    <div className="absolute inset-x-4 bottom-4 z-[100] max-h-[80%] bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] rounded-[24px] shadow-2xl animate-in slide-in-from-bottom-4 duration-300 overflow-hidden flex flex-col">
      <div className="px-6 py-4 border-b border-slate-50 dark:border-[#2a2a2a] flex items-center justify-between bg-slate-50/50 dark:bg-[#121212]">
        <div className="flex items-center gap-2">
          <MaterialIcon name="add_link" className="text-primary" />
          <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest">引用知识库资源</h2>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <MaterialIcon name="close" />
        </button>
      </div>

      <div className="p-4 border-b border-slate-50 dark:border-[#2a2a2a]">
        <div className="relative">
          <MaterialIcon
            name="search"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400"
          />
          <input
            type="text"
            placeholder="搜索资源库..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="w-full bg-slate-100 dark:bg-[#121212] border-none rounded-xl pl-10 pr-4 py-2 text-xs focus:ring-1 focus:ring-primary text-slate-700 dark:text-[#e0e0e0]"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col gap-2 p-4 overflow-y-auto custom-scrollbar">
        {visibleResources.map((res) => {
          const isSelected = selectedResourceIds.includes(res.id);
          const isReferenceDisabled = res.status !== undefined && res.status !== 'DONE';
          const referenceTitle = isReferenceDisabled ? '正在处理中' : undefined;
          return (
            <div
              key={res.id}
              onClick={() => {
                if (isReferenceDisabled) return;
                onToggleResource(res);
              }}
              title={referenceTitle}
              className={`group min-h-10 px-3 py-2.5 bg-white dark:bg-[#121212] border rounded-xl transition-all flex items-center gap-3 relative overflow-hidden ${
                isSelected
                  ? 'border-primary shadow-lg shadow-primary/10'
                  : isReferenceDisabled
                    ? 'border-slate-100 dark:border-[#2a2a2a] opacity-60 cursor-not-allowed'
                    : 'border-slate-100 dark:border-[#2a2a2a] hover:border-primary hover:shadow-lg cursor-pointer'
              }`}
            >
              <div
                className={`size-6 rounded-md flex items-center justify-center transition-all shrink-0 ${
                  isSelected
                    ? 'bg-primary text-white'
                    : 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white'
                }`}
              >
                <MaterialIcon name={res.icon} className="text-[14px]" />
              </div>
              <h4 className="text-[11px] font-bold text-slate-800 dark:text-white truncate group-hover:text-primary flex-1">
                {res.title}
              </h4>
              <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              {isSelected && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 size-5 rounded-full bg-primary text-white flex items-center justify-center shadow">
                  <MaterialIcon name="check" className="text-[12px]" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-4 bg-slate-50 dark:bg-[#121212] text-center border-t border-slate-100 dark:border-[#2a2a2a]">
        <button
          type="button"
          onClick={handleToggleAll}
          disabled={selectableResources.length === 0}
          className="text-[10px] font-bold text-primary hover:underline disabled:text-slate-400 disabled:no-underline disabled:cursor-not-allowed"
        >
          {allSelected ? '全部取消' : '全部引用'}
        </button>
      </div>
    </div>
  );
};

export default SidebarAddResourceModal;
