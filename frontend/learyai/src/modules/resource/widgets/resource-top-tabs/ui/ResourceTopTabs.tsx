// ResourceTopTabs 负责资源中心顶部标签与聚合分组的统一渲染。
import React, { useEffect, useMemo, useRef, useState } from 'react';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';
import type { ResourceCenterDetailTabKey, ResourceCenterTabItem } from '../../../entities/resource-center';
import ResourceTabChip from './ResourceTabChip';
import ResourceTabGroup from './ResourceTabGroup';
import type { ResourceTopTabsProps } from './types';

const ResourceTopTabs: React.FC<ResourceTopTabsProps> = ({
  topTabItems,
  detailTabGroups,
  activeTopPanel,
  activePanel,
  activeListTab,
  detailMergeDropZonePrefix,
  onSelectTopTab,
  onCloseDetailTab,
  onCloseSingleDetailTab,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileDetailMenuOpen, setIsMobileDetailMenuOpen] = useState(false);
  const fixedMenuRef = useRef<HTMLDivElement>(null);
  const detailMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMobileMenuOpen && !isMobileDetailMenuOpen) return undefined;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedFixedMenu = fixedMenuRef.current?.contains(target);
      const clickedDetailMenu = detailMenuRef.current?.contains(target);
      if (!clickedFixedMenu && !clickedDetailMenu) {
        setIsMobileMenuOpen(false);
        setIsMobileDetailMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobileDetailMenuOpen, isMobileMenuOpen]);

  const fixedTabs = useMemo(
    () => topTabItems.filter((tab) => !tab.closable),
    [topTabItems]
  );
  const detailTabs = useMemo(
    () => topTabItems.filter((tab) => tab.closable),
    [topTabItems]
  );
  const activeFixedTab = fixedTabs.find((tab) => tab.key === activeListTab) ?? fixedTabs.find((tab) => tab.key === 'all') ?? fixedTabs[0];
  const hasMultipleFixedTabs = fixedTabs.length > 1;
  const mobileDetailMenuItems = useMemo(() => detailTabs.flatMap((tab) => {
    const groupMembers = detailTabGroups[tab.key as ResourceCenterDetailTabKey] ?? [];
    if (groupMembers.length > 1) {
      return groupMembers.map((member) => ({
        key: member.key,
        label: member.label,
        onClose: onCloseSingleDetailTab,
      }));
    }
    return [{
      key: tab.key as ResourceCenterDetailTabKey,
      label: tab.label,
      onClose: onCloseDetailTab,
    }];
  }), [detailTabGroups, detailTabs, onCloseDetailTab, onCloseSingleDetailTab]);
  const activeMobileDetailItem = mobileDetailMenuItems.find((item) => item.key === activePanel)
    ?? mobileDetailMenuItems.find((item) => item.key === activeTopPanel)
    ?? mobileDetailMenuItems[0];

  const renderTab = (tab: ResourceCenterTabItem) => {
    const groupMembers = tab.closable
      ? detailTabGroups[tab.key as ResourceCenterDetailTabKey] ?? []
      : [];
    const mergeDropZoneId = tab.closable
      ? `${detailMergeDropZonePrefix}${String(tab.key)}`
      : undefined;
    if (tab.closable && groupMembers.length > 1 && mergeDropZoneId) {
      return (
        <ResourceTabGroup
          key={tab.key}
          tab={tab}
          members={groupMembers}
          activeTopPanel={activeTopPanel}
          activePanel={activePanel}
          onSelect={onSelectTopTab}
          onCloseGroup={onCloseDetailTab}
          onCloseSingle={onCloseSingleDetailTab}
          mergeDropZoneId={mergeDropZoneId}
        />
      );
    }
    return (
      <ResourceTabChip
        key={tab.key}
        tab={tab}
        activePanel={activeTopPanel}
        onSelect={onSelectTopTab}
        onClose={tab.closable ? onCloseDetailTab : undefined}
        draggable={Boolean(tab.closable)}
        mergeDropZoneId={mergeDropZoneId}
      />
    );
  };

  return (
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 items-center gap-3 sm:hidden">
        <div className="flex shrink-0 items-center gap-2">
          {activeFixedTab ? (
            <div className="relative shrink-0" ref={fixedMenuRef}>
              <div
                className={`inline-flex items-center border-b-2 transition-colors ${
                  activeFixedTab.key === activeListTab
                    ? 'border-primary text-primary dark:text-white'
                    : 'border-transparent text-slate-400 dark:text-[#a0a0a0]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsMobileDetailMenuOpen(false);
                    onSelectTopTab(activeFixedTab.key);
                  }}
                  className="px-1 py-4 text-xs font-bold tracking-widest"
                  aria-label={`切换到${activeFixedTab.label}`}
                >
                  <span className="max-w-[88px] truncate">{activeFixedTab.label}</span>
                </button>
                {hasMultipleFixedTabs ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileDetailMenuOpen(false);
                      setIsMobileMenuOpen((prev) => !prev);
                    }}
                    className="py-4 pr-1 text-current"
                    aria-label="展开分类选择"
                  >
                    <MaterialIcon
                      name="arrow_drop_down"
                      className={`text-base transition-transform ${isMobileMenuOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                ) : null}
              </div>
              {hasMultipleFixedTabs && isMobileMenuOpen ? (
                <div className="absolute left-0 top-full z-20 mt-2 min-w-40 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-[#2a2a2a] dark:bg-[#121212]">
                  {fixedTabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      disabled={tab.disabled}
                      onClick={() => {
                        if (tab.disabled) return;
                        onSelectTopTab(tab.key);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold transition-colors ${
                        tab.disabled
                          ? 'cursor-not-allowed text-slate-300 dark:text-[#666]'
                          : tab.key === activeListTab
                          ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-white'
                          : 'text-slate-500 hover:bg-slate-50 dark:text-[#d0d0d0] dark:hover:bg-[#1a1a1a]'
                      }`}
                    >
                      <span>{tab.label}</span>
                      {tab.key === activeListTab ? <MaterialIcon name="check" className="text-sm" /> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        {detailTabs.length ? (
          <>
            <div className="min-w-0 flex-1 overflow-x-auto custom-scrollbar max-[420px]:hidden">
              <div className="flex w-max gap-3">
                {detailTabs.map(renderTab)}
              </div>
            </div>
            <div className="relative hidden min-w-0 flex-1 max-[420px]:block" ref={detailMenuRef}>
              <div className="flex justify-end">
                <div
                  className={`inline-flex max-w-full items-center rounded-lg border-b-2 transition-colors ${
                    activeMobileDetailItem
                      ? 'border-primary text-primary dark:text-white'
                      : 'border-transparent text-slate-400 dark:text-[#a0a0a0]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (!activeMobileDetailItem) return;
                      setIsMobileMenuOpen(false);
                      setIsMobileDetailMenuOpen(false);
                      onSelectTopTab(activeMobileDetailItem.key);
                    }}
                    className="min-w-0 px-1 py-4 text-xs font-bold tracking-widest"
                    aria-label={activeMobileDetailItem ? `切换到详情${activeMobileDetailItem.label}` : '切换到详情标签'}
                  >
                    <span className="block max-w-[104px] truncate">
                      {activeMobileDetailItem?.label ?? `详情 (${mobileDetailMenuItems.length})`}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setIsMobileDetailMenuOpen((prev) => !prev);
                    }}
                    className="py-4 pr-1 text-current"
                    aria-label="展开详情标签选择"
                  >
                    <MaterialIcon
                      name="arrow_drop_down"
                      className={`text-base transition-transform ${isMobileDetailMenuOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                </div>
              </div>
              {isMobileDetailMenuOpen ? (
                <div className="absolute right-0 top-full z-20 mt-2 min-w-48 max-w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-[#2a2a2a] dark:bg-[#121212]">
                  {mobileDetailMenuItems.map((item) => (
                    <div
                      key={item.key}
                      className={`flex items-center gap-2 rounded-xl px-3 py-2 transition-colors ${
                        item.key === activePanel || item.key === activeTopPanel
                          ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-white'
                          : 'text-slate-500 hover:bg-slate-50 dark:text-[#d0d0d0] dark:hover:bg-[#1a1a1a]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onSelectTopTab(item.key);
                          setIsMobileDetailMenuOpen(false);
                        }}
                        className="min-w-0 flex-1 text-left text-xs font-semibold"
                      >
                        <span
                          className="block overflow-hidden break-all text-[13px] leading-5"
                          style={{
                            display: '-webkit-box',
                            WebkitBoxOrient: 'vertical',
                            WebkitLineClamp: 2,
                          }}
                        >
                          {item.label}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          item.onClose(item.key);
                          setIsMobileDetailMenuOpen(false);
                        }}
                        className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-slate-300 hover:bg-rose-50 hover:text-rose-500"
                        aria-label={`关闭详情${item.label}`}
                      >
                        <MaterialIcon name="close" className="text-[12px]" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
      <div className="hidden min-w-0 flex-1 overflow-x-auto custom-scrollbar sm:block">
        <div className="flex w-max gap-8">
          {topTabItems.map(renderTab)}
        </div>
      </div>
    </div>
  );
};

export default ResourceTopTabs;
