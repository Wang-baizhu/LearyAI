// ResourceActionMenu 负责资源中心的浮动操作菜单，包括导入与生成类入口。
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAppDispatch } from '@/app/store/hooks';
import MobileActionSheet, { type MobileActionSheetAction } from '@/shared/ui/MobileActionSheet';
import { openImport, openImportText, openImportUrl } from '../../../entities/resource-center';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';
import { TourStep } from '@leary/tour-guide';

interface ResourceActionMenuProps {
  label?: string;
  variant?: 'floating' | 'sheet';
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  generateActions?: Array<{
    key: string;
    label: string;
    icon: string;
    enabled?: boolean;
    onClick: () => void;
  }>;
  onGenerateKbview?: () => void;
}

const RESOURCE_CENTER_GUIDE_TAG = 'guide:resource-center:v1';

const ResourceActionMenu: React.FC<ResourceActionMenuProps> = ({
  label,
  variant = 'floating',
  isOpen,
  onOpenChange,
  generateActions = [],
  onGenerateKbview,
}) => {
  const dispatch = useAppDispatch();
  const resolvedLabel = label ?? '操作';
  const containerRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [isFloatingOpen, setIsFloatingOpen] = useState(true);
  const resolvedIsOpen = variant === 'sheet' ? Boolean(isOpen) : isFloatingOpen;

  const actions = useMemo(
    () => [
      {
        key: 'kbview',
        label: '生成关系图',
        icon: 'hub',
        enabled: Boolean(onGenerateKbview),
        visible: true,
        onClick: onGenerateKbview,
      },
      ...generateActions.map((action) => ({
        ...action,
        enabled: action.enabled ?? true,
        visible: true,
      })),
      {
        key: 'import-text',
        label: '导入文本',
        icon: 'notes',
        // WARN: 当前前端未按项目角色收敛该入口，但后端文本导入仍要求 admin/owner，后续需补权限 gating。
        enabled: true,
        visible: true,
        onClick: () => dispatch(openImportText()),
      },
      {
        key: 'import-url',
        label: '导入链接',
        icon: 'link',
        enabled: true,
        visible: true,
        onClick: () => dispatch(openImportUrl()),
      },
      {
        key: 'import',
        label: '导入文档',
        icon: 'upload_file',
        enabled: true,
        visible: true,
        onClick: () => dispatch(openImport()),
      },
    ],
    [dispatch, generateActions, onGenerateKbview]
  );

  const visibleActions = useMemo(() => actions.filter((item) => item.visible), [actions]);

  useEffect(() => {
    if (variant !== 'floating' || !resolvedIsOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsFloatingOpen(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [resolvedIsOpen, variant]);

  useEffect(() => {
    if (!resolvedIsOpen || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [resolvedIsOpen, visibleActions.length]);

  const handleToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setIsFloatingOpen((prev) => !prev);
  };

  const handleActionClick = (action: (typeof actions)[number]) => {
    if (!action.enabled || !action.onClick) return;
    action.onClick();
    if (variant === 'sheet') {
      onOpenChange?.(false);
      return;
    }
    setIsFloatingOpen(false);
  };

  const handleActionPlaceholder = () => {
    setIsFloatingOpen(false);
  };

  if (variant === 'sheet') {
    const sheetActions: MobileActionSheetAction[] = visibleActions.map((action) => ({
      key: action.key,
      label: action.label,
      icon: action.icon,
      onClick: () => {
        if (action.onClick) {
          handleActionClick(action);
          return;
        }
        handleActionPlaceholder();
      },
      disabled: !action.enabled,
    }));

    return (
      <MobileActionSheet
        isOpen={resolvedIsOpen}
        title={resolvedLabel}
        actions={sheetActions}
        onClose={() => onOpenChange?.(false)}
        actionsClassName="grid grid-cols-2 gap-3"
      />
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col items-end gap-3">
      <div
        className={`relative flex-col items-end transition-all duration-200 ${
          resolvedIsOpen ? 'flex' : 'hidden'
        }`}
      >
        <div className="absolute -top-2 left-0 right-0 h-4 bg-gradient-to-b from-white/70 to-transparent dark:from-[#121212]/70 pointer-events-none z-10" />
        <div
          ref={listRef}
          className="max-h-60 overflow-y-auto flex flex-col items-end gap-3 px-2 py-1"
        >
          {visibleActions.map((action, index) => (
            <button
              key={action.key}
              type="button"
              onClick={() => (action.onClick ? handleActionClick(action) : handleActionPlaceholder())}
              disabled={!action.enabled}
              style={{ transitionDelay: resolvedIsOpen ? `${index * 50}ms` : '0ms' }}
              className={`group flex items-center px-3 py-2 rounded-2xl border shadow-md transition-all duration-300 ease-out ${
                action.enabled
                  ? 'bg-white text-slate-600 border-slate-100 hover:bg-primary/10 hover:text-primary dark:bg-[#1b1f26] dark:text-slate-100 dark:border-[#2a2f37]'
                  : 'bg-white/70 text-slate-400 border-slate-100/70 cursor-not-allowed dark:bg-[#14181f] dark:text-slate-500 dark:border-[#232831]'
              } ${resolvedIsOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
            >
              <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm font-medium transition-[max-width,margin-right] duration-300 ease-out group-hover:max-w-28 group-hover:mr-2">
                {action.label}
              </span>
              <span
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  action.enabled
                    ? 'bg-primary/10 text-primary dark:bg-primary/15'
                    : 'bg-slate-100 text-slate-400 dark:bg-[#1a1f27]'
                }`}
              >
                <MaterialIcon name={action.icon} className="text-[18px]" />
              </span>
            </button>
          ))}
        </div>
      </div>

      <TourStep
        tag={RESOURCE_CENTER_GUIDE_TAG}
        order={1}
        title="上传与生成入口"
        content="这里可以触发上传参考文档，也可以生成可视化模板，例如题目、卡片和思维导图。"
        actionLabel="知道了"
      >
        <button
          type="button"
          aria-label={resolvedLabel}
          aria-expanded={resolvedIsOpen}
          onClick={handleToggle}
          className="flex items-center justify-center w-14 h-14 rounded-2xl bg-accent text-white shadow-xl shadow-accent/30 transition-all duration-200 hover:scale-105 active:scale-95"
        >
          <MaterialIcon
            name="add"
            className={`text-[28px] transition-transform duration-200 ${resolvedIsOpen ? 'rotate-[135deg]' : ''}`}
          />
        </button>
      </TourStep>
    </div>
  );
};

export default ResourceActionMenu;
