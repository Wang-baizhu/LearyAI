// ResourceTabChip 负责渲染可拖拽、可关闭、可脱组的顶部标签项。
import React, { useCallback, useRef } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';
import type { ResourceCenterDetailTabKey, ResourceCenterPanel, ResourceCenterTabItem } from '../../../entities/resource-center';

interface ResourceTabChipProps {
  tab: ResourceCenterTabItem;
  activePanel: ResourceCenterPanel;
  onSelect: (tabKey: ResourceCenterPanel) => void;
  onClose?: (tabKey: ResourceCenterDetailTabKey) => void;
  draggable?: boolean;
  mergeDropZoneId?: string;
  compact?: boolean;
  stopParentSelect?: boolean;
}

const CLICK_SELECT_THRESHOLD = 5;
const isActionTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && Boolean(target.closest('[data-tab-chip-action="true"]'));

const ResourceTabChip: React.FC<ResourceTabChipProps> = ({
  tab,
  activePanel,
  onSelect,
  onClose,
  draggable = false,
  mergeDropZoneId,
  compact = false,
  stopParentSelect = false,
}) => {
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: tab.key,
    disabled: !draggable,
  });
  const { setNodeRef: setDropNodeRef, isOver } = useDroppable({
    id: mergeDropZoneId ?? `tab:${tab.key}`,
    disabled: !mergeDropZoneId,
  });
  const setCombinedNodeRef = useCallback(
    (node: HTMLElement | null) => {
      setNodeRef(node);
      setDropNodeRef(node);
    },
    [setDropNodeRef, setNodeRef]
  );

  return (
    <button
      ref={setCombinedNodeRef}
      type="button"
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        transition: draggable ? 'transform 150ms ease' : undefined,
        touchAction: 'none',
      }}
      className={`inline-flex items-center rounded-lg transition-all ${
        compact
          ? 'max-w-[112px] px-2 py-1 text-xs font-bold tracking-wide sm:max-w-[160px]'
          : 'max-w-[128px] border-b-2 px-1 py-4 text-xs font-bold tracking-widest sm:max-w-[200px]'
      } ${tab.disabled ? 'cursor-not-allowed opacity-45' : draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${
        isDragging ? 'opacity-70 scale-[0.98]' : ''
      } ${
        compact
          ? tab.disabled
            ? 'bg-slate-100 text-slate-400 dark:bg-[#1a1a1a] dark:text-[#666]'
            : tab.key === activePanel
            ? 'bg-primary text-white'
            : 'text-slate-500 dark:text-[#a0a0a0] hover:text-slate-700 dark:hover:text-[#e0e0e0]'
          : tab.disabled
            ? 'border-transparent text-slate-300 dark:text-[#666]'
            : tab.key === activePanel
            ? 'border-primary text-primary dark:text-white'
            : isOver
              ? 'border-primary/40 text-slate-600 dark:text-[#e0e0e0]'
              : 'border-transparent text-slate-400 dark:text-[#a0a0a0] hover:text-slate-600 dark:hover:text-[#e0e0e0]'
      }`}
      onClick={(event) => {
        if (tab.disabled) return;
        if (event.detail !== 0) return;
        if (stopParentSelect) {
          event.stopPropagation();
        }
        onSelect(tab.key);
      }}
      onPointerDownCapture={(event) => {
        if (stopParentSelect) {
          event.stopPropagation();
        }
        if (isActionTarget(event.target)) {
          pointerStartRef.current = null;
          return;
        }
        if (tab.disabled) {
          pointerStartRef.current = null;
          return;
        }
        pointerStartRef.current = {
          x: event.clientX,
          y: event.clientY,
        };
      }}
      onPointerUpCapture={(event) => {
        if (stopParentSelect) {
          event.stopPropagation();
        }
        if (isActionTarget(event.target)) {
          pointerStartRef.current = null;
          return;
        }
        const start = pointerStartRef.current;
        pointerStartRef.current = null;
        if (!start) return;
        if (tab.disabled) return;
        const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
        if (moved <= CLICK_SELECT_THRESHOLD) {
          onSelect(tab.key);
        }
      }}
      onPointerCancel={() => {
        pointerStartRef.current = null;
      }}
      onBlur={() => {
        pointerStartRef.current = null;
      }}
      onPointerDown={(event) => {
        if (stopParentSelect) {
          event.stopPropagation();
        }
      }}
      {...(draggable ? attributes : {})}
      {...(draggable ? listeners : {})}
      disabled={tab.disabled}
    >
      <span className="truncate">{tab.label}</span>
      {tab.closable ? (
        <span className={`${compact ? 'ml-1 flex items-center gap-0.5' : 'ml-2 inline-flex items-center gap-1'}`}>
          {onClose ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation();
                onClose(tab.key as ResourceCenterDetailTabKey);
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              data-tab-chip-action="true"
              className="inline-flex items-center justify-center size-4 rounded-full text-slate-300 hover:text-rose-500 hover:bg-rose-50"
              aria-label="关闭标签"
            >
              <MaterialIcon name="close" className="text-[12px]" />
            </span>
          ) : null}
        </span>
      ) : null}
    </button>
  );
};

export default ResourceTabChip;
