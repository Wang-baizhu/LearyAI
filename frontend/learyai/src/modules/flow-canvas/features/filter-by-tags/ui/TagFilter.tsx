// TagFilter 负责提供白板节点标签筛选面板。
import React from 'react';
import { useStore } from 'zustand';
import { Filter, X } from 'lucide-react';
import type { GraphStoreApi } from '../../../entities/graph';
import { mergeClassName } from '../../../shared/lib/className';

interface TagFilterProps {
  store: GraphStoreApi;
}

export const TagFilter: React.FC<TagFilterProps> = ({ store }) => {
  const { nodes, selectedTags, setSelectedTags } = useStore(store);

  const allTags = React.useMemo(() => {
    const tags = new Set<string>();
    nodes.forEach((node) => {
      node.data.tags?.forEach((tag) => tags.add(tag));
    });
    return Array.from(tags);
  }, [nodes]);

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((currentTag) => currentTag !== tag));
      return;
    }

    setSelectedTags([...selectedTags, tag]);
  };

  if (allTags.length === 0) {
    return null;
  }

  return (
    <div className="absolute right-4 top-4 z-10 flex flex-col items-end gap-2">
      <div className="min-w-[120px] rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-xl backdrop-blur-md">
        <div className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Filter size={14} />
          <span>标签过滤</span>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={mergeClassName(
                'cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-200',
                selectedTags.includes(tag)
                  ? 'border-blue-600 bg-blue-500 text-white shadow-md shadow-blue-200'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-slate-50'
              )}
            >
              {tag}
            </button>
          ))}
        </div>
        {selectedTags.length > 0 && (
          <button
            onClick={() => setSelectedTags([])}
            className="mt-3 flex w-full items-center justify-center gap-1 border-t border-slate-100 py-1 text-[10px] text-slate-400 transition-colors hover:text-slate-600"
          >
            <X size={10} />
            清除选择
          </button>
        )}
      </div>
    </div>
  );
};
