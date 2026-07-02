// ResourceTabGroup 负责渲染聚合分组容器及组内成员交互。
import React from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';
import { DETAIL_GROUP_DRAG_ID_PREFIX } from '../../../entities/resource-center';
import type { ResourceCenterDetailTab, ResourceCenterDetailTabKey, ResourceCenterPanel, ResourceCenterTabItem } from '../../../entities/resource-center';
import ResourceTabChip from './ResourceTabChip';

interface ResourceTabGroupProps {
  tab: ResourceCenterTabItem;
  members: ResourceCenterDetailTab[];
  activeTopPanel: ResourceCenterPanel;
  activePanel: ResourceCenterPanel;
  onSelect: (tabKey: ResourceCenterPanel) => void;
  onCloseGroup: (key: ResourceCenterDetailTabKey) => void;
  onCloseSingle: (key: ResourceCenterDetailTabKey) => void;
  mergeDropZoneId: string;
}

const GROUP_COLLAPSED_MAX_WIDTH = 280;
const GROUP_EXPANDED_MAX_WIDTH = 520;
const GROUP_COLLAPSED_MOBILE_MAX_WIDTH = 184;
const GROUP_EXPANDED_MOBILE_MAX_WIDTH = 296;

const ResourceTabGroup: React.FC<ResourceTabGroupProps> = ({
  tab,
  members,
  activeTopPanel,
  activePanel,
  onSelect,
  onCloseGroup,
  onCloseSingle,
  mergeDropZoneId,
}) => {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({
    id: `${DETAIL_GROUP_DRAG_ID_PREFIX}${String(tab.key)}`,
    disabled: false,
  });
  const { setNodeRef: setDropNodeRef, isOver } = useDroppable({
    id: mergeDropZoneId,
    disabled: false,
  });
  const groupStyle = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition: 'transform 800ms ease, max-width 1100ms ease',
    touchAction: 'none',
    '--group-collapsed': `${GROUP_COLLAPSED_MAX_WIDTH}px`,
    '--group-expanded': `${GROUP_EXPANDED_MAX_WIDTH}px`,
    '--group-collapsed-mobile': `${GROUP_COLLAPSED_MOBILE_MAX_WIDTH}px`,
    '--group-expanded-mobile': `${GROUP_EXPANDED_MOBILE_MAX_WIDTH}px`,
  } as React.CSSProperties & Record<string, string>;

  return (
    <div
      ref={setNodeRef}
      style={groupStyle}
      className={`group my-1 inline-flex items-center gap-2 overflow-hidden rounded-xl border px-2 py-1.5 max-w-[var(--group-collapsed-mobile)] hover:max-w-[var(--group-expanded-mobile)] focus-within:max-w-[var(--group-expanded-mobile)] sm:max-w-[var(--group-collapsed)] sm:hover:max-w-[var(--group-expanded)] sm:focus-within:max-w-[var(--group-expanded)] ${
        isDragging ? 'opacity-70 scale-[0.98]' : ''
      } ${
        tab.key === activeTopPanel
          ? 'border-primary/70 bg-primary/5'
          : isOver
            ? 'border-primary/40 bg-slate-50 dark:bg-[#1a1a1a]'
            : 'border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#121212]'
      }`}
    >
      <div className="flex max-w-[calc(var(--group-expanded-mobile)-88px)] items-center gap-1 overflow-x-auto custom-scrollbar sm:max-w-[calc(var(--group-expanded)-88px)]">
        {members.map((member) => (
          <ResourceTabChip
            key={member.key}
            tab={{
              key: member.key,
              label: member.label,
              closable: true,
            }}
            activePanel={activePanel}
            onSelect={onSelect}
            onClose={onCloseSingle}
            draggable
            compact
          />
        ))}
      </div>
      <span
        ref={setDropNodeRef}
        className={`inline-flex items-center justify-center px-1 text-[10px] font-black tracking-widest rounded-md shrink-0 ${
          isOver ? 'text-primary bg-primary/10' : 'text-slate-400'
        }`}
        aria-label="合并落点"
      >
        {members.length}
      </span>
      <span
        ref={setActivatorNodeRef}
        className="inline-flex items-center justify-center size-5 rounded-md text-slate-300 hover:text-slate-500 hover:bg-slate-100 dark:hover:bg-[#1a1a1a] cursor-grab active:cursor-grabbing shrink-0"
        aria-label="拖拽分组"
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        {...attributes}
        {...listeners}
      >
        <MaterialIcon name="drag_indicator" className="text-[14px]" />
      </span>
      <span
        role="button"
        tabIndex={0}
        onClick={(event) => {
          event.stopPropagation();
          onCloseGroup(tab.key as ResourceCenterDetailTabKey);
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        className="inline-flex items-center justify-center size-5 rounded-full text-slate-300 hover:text-rose-500 hover:bg-rose-50 shrink-0"
        aria-label="关闭聚合标签"
      >
        <MaterialIcon name="close" className="text-[12px]" />
      </span>
    </div>
  );
};

export default ResourceTabGroup;
