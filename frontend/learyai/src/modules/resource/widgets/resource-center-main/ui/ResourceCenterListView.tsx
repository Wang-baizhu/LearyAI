// ResourceCenterListView 负责渲染资源中心列表内容及分页。
import React, { useEffect, useMemo } from 'react';
import type { ResourceListItem } from '../../../../kbdoc';
import { ResourceGrid } from '../../../../kbdoc';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';
import SkeletonLoader from '@/shared/ui/SkeletonLoader';
import { safeLocalStorageGet, safeLocalStorageSet } from '@/shared/lib/safeLocalStorage';
import { useResourceScope } from '../../../entities/resource-center';
import type { ResourceCenterListViewProps } from '../model/types';

const RESOURCE_CENTER_COUNT_STORAGE_PREFIX = 'resource-center:list-count';

const resolveResourceCenterCountKey = (
  kbId: string | undefined,
  panel: string,
  section?: string
) => (
  section
    ? `${RESOURCE_CENTER_COUNT_STORAGE_PREFIX}:${kbId ?? 'global'}:${panel}:${section}`
    : `${RESOURCE_CENTER_COUNT_STORAGE_PREFIX}:${kbId ?? 'global'}:${panel}`
);

const readPersistedCount = (key: string): number => {
  const raw = safeLocalStorageGet(key);
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
};

const persistCount = (key: string, count: number) => {
  if (!Number.isFinite(count) || count < 0) return;
  safeLocalStorageSet(key, String(Math.floor(count)));
};

const resolveSkeletonCount = (key: string, fallback = 2): number => {
  const count = readPersistedCount(key);
  if (count > 0) return Math.min(count, 12);
  return fallback;
};

const ResourceGridSkeleton: React.FC<{ cardCount?: number }> = ({ cardCount = 4 }) => (
  <div className="grid min-w-[520px] grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-2">
    {Array.from({ length: cardCount }).map((_, index) => (
      <div
        key={`resource-grid-skeleton-${index}`}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#2a2a2a] dark:bg-[#1a1a1a]"
      >
        <div className="mb-4 flex items-start justify-between">
          <div className="size-11 rounded-xl bg-slate-100 dark:bg-[#121212]" />
          <div className="w-[40%]">
            <SkeletonLoader
              barCount={1}
              maxWidths={['100%']}
              barHeightClassName="h-7"
              delayBase={90}
            />
          </div>
        </div>
        <SkeletonLoader
          barCount={3}
          maxWidths={['92%', '76%', '58%']}
          delayBase={100}
          className="mb-6"
        />
        <div className="border-t border-slate-100 pt-4 dark:border-[#2a2a2a]">
          <SkeletonLoader
            barCount={1}
            maxWidths={['35%']}
            barHeightClassName="h-3"
            delayBase={90}
          />
        </div>
      </div>
    ))}
  </div>
);

const ResourceLoadingPlaceholder: React.FC<{ label: string }> = ({ label }) => (
  <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/60 p-10 text-center text-slate-400 dark:border-[#2a2a2a] dark:bg-[#1a1a1a]">
    <div className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400 dark:text-[#a0a0a0]">
      加载中
    </div>
    <p className="text-sm">{label}</p>
  </div>
);

const DEFAULT_PANEL_META_BY_TAB: Record<string, { label: string; icon: string }> = {
  all: { label: '全部资源', icon: 'folder' },
  kbdoc: { label: '参考文档', icon: 'book_2' },
};

const ResourceCenterListView: React.FC<ResourceCenterListViewProps> = ({
  panel,
  variant,
  listState,
  listActions,
  onToggleCollapsed,
}) => {
  const { projectId, kbId } = useResourceScope();
  const panelMeta = listActions?.panelMetaByTab?.[panel] ?? DEFAULT_PANEL_META_BY_TAB[panel] ?? { label: panel, icon: 'folder' };
  const panelLabel = panelMeta.label;
  const panelIcon = panelMeta.icon;
  const rawSections = listState?.sections;
  const normalizedSections = useMemo<Array<{
    key: string;
    panel: string;
    label: string;
    items?: ResourceListItem[];
    total?: number;
    isLoading?: boolean;
    isError?: boolean;
    errorMessage?: string;
  }>>(() => {
    if (Array.isArray(rawSections)) {
      return rawSections as Array<{
        key: string;
        panel: string;
        label: string;
        items?: ResourceListItem[];
        total?: number;
        isLoading?: boolean;
        isError?: boolean;
        errorMessage?: string;
      }>;
    }
    if (!rawSections) {
      return [];
    }
    return Object.entries(rawSections).map(([key, value]) => ({
      key,
      panel: key === 'docs' ? 'kbdoc' : key,
      label: key === 'docs' ? '参考文档' : key,
      ...(value as Record<string, unknown>),
    }));
  }, [rawSections]);

  useEffect(() => {
    if (!listState) return;
    if (listState.kind === 'mixed' && normalizedSections.length > 0) {
      normalizedSections.forEach((section) => {
        if (!section.isLoading && !section.isError) {
          persistCount(resolveResourceCenterCountKey(kbId, panel, section.key), section.items?.length ?? 0);
        }
      });
      return;
    }

    if (listState.isGridLoading || listState.isGridError) return;
    persistCount(resolveResourceCenterCountKey(kbId, panel), listState.gridItems.length);
  }, [kbId, listState, normalizedSections, panel]);

  if (!listState || !listActions) return null;

  const {
    gridItems,
    itemCount,
    isGridLoading,
    isGridError,
    gridErrorMessage,
    totalPages,
    kind,
    isKnowledgeTab,
    aggregatedGroups,
    page,
    showPagination,
  } = listState;
  const isMixedList = kind === 'mixed';
  const shouldShowGlobalViewButton =
    variant === 'main' &&
    panel === 'all' &&
    typeof listActions.onOpenGlobalView === 'function';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {variant === 'sidebar' && (
        <header className="border-b border-slate-50 p-6 dark:border-[#2a2a2a]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-white shadow-lg shadow-primary/20">
                <MaterialIcon name={panelIcon} />
              </div>
              <div>
                <h1 className="text-base font-bold leading-tight text-slate-900 dark:text-white">{panelLabel}</h1>
              </div>
            </div>
            {onToggleCollapsed ? (
              <button
                type="button"
                onClick={onToggleCollapsed}
                className="size-9 rounded-lg border border-slate-100 bg-slate-50 text-slate-400 transition-all hover:text-primary active:scale-90 dark:border-[#2a2a2a] dark:bg-[#121212]"
                aria-label="收起侧栏"
              >
                <MaterialIcon name="chevron_left" className="text-[20px]" />
              </button>
            ) : null}
          </div>
        </header>
      )}
      <div className="custom-scrollbar flex-1 space-y-8 overflow-y-auto p-4 md:p-6 lg:space-y-10 lg:p-8">
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-[#a0a0a0]">
                {panelLabel}
              </h3>
              <span className="text-[11px] text-slate-400">{itemCount} 条</span>
            </div>
            <div className="flex items-center gap-3">
              {shouldShowGlobalViewButton ? (
                <button
                  type="button"
                  onClick={listActions.onOpenGlobalView}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-primary hover:text-primary dark:border-[#2a2a2a] dark:bg-[#171717] dark:text-[#d0d0d0] dark:hover:border-primary dark:hover:text-white md:px-4"
                  aria-label="查看全局视图"
                >
                  <MaterialIcon name="hub" className="text-base" />
                  <span>全局</span>
                </button>
              ) : null}
            </div>
          </div>

          {!isKnowledgeTab && panel === 'all' && !isGridLoading && aggregatedGroups.length ? (
            <div className="mb-4 flex flex-wrap gap-2 text-[11px] text-slate-500 dark:text-[#a0a0a0]">
              {aggregatedGroups.map((group) => (
                <span
                  key={group.key}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 dark:border-[#2a2a2a] dark:bg-[#1a1a1a]"
                >
                  <span className="font-black uppercase tracking-widest">{group.label}</span>
                  <span className="text-[10px] text-slate-400"> · {group.total} 条</span>
                </span>
              ))}
            </div>
          ) : null}

          {isMixedList && panel === 'all' ? (
            <div className="space-y-8">
              {normalizedSections.map((sectionState) => (
                <div key={sectionState.key}>
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-[#a0a0a0]">
                      {sectionState.label}
                    </h4>
                    <span className="text-[11px] text-slate-400">{sectionState.total ?? 0} 条</span>
                  </div>
                  {(() => {
                    const skeletonCount = resolveSkeletonCount(
                      resolveResourceCenterCountKey(kbId, panel, sectionState.key),
                      2
                    );
                    if (!sectionState.isLoading) return null;
                    return skeletonCount > 0
                      ? <ResourceGridSkeleton cardCount={skeletonCount} />
                      : <ResourceLoadingPlaceholder label="加载参考文档列表中..." />;
                  })()}
                  {!sectionState.isLoading && sectionState.isError ? (
                    <div className="text-sm text-rose-500">{sectionState.errorMessage}</div>
                  ) : !sectionState.isLoading ? (
                    <ResourceGrid
                      items={sectionState.items ?? []}
                      projectId={projectId}
                      onOpen={listActions.onOpenResource}
                      referencedDocIds={listActions.referencedDocIds}
                      onToggleReference={listActions.onToggleReference}
                      onResourceDeleted={listActions.onResourceDeleted}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          ) : isKnowledgeTab ? (
            isGridLoading ? (
              (() => {
                const skeletonCount = resolveSkeletonCount(
                  resolveResourceCenterCountKey(kbId, panel),
                  2
                );
                return skeletonCount > 0
                  ? <ResourceGridSkeleton cardCount={skeletonCount} />
                  : <ResourceLoadingPlaceholder label="加载参考文档列表中..." />;
              })()
            ) : isGridError ? (
              <div className="text-sm text-rose-500">参考文档加载失败，请稍后重试。</div>
            ) : (
              <ResourceGrid
                items={gridItems}
                projectId={projectId}
                onOpen={listActions.onOpenResource}
                referencedDocIds={listActions.referencedDocIds}
                onToggleReference={listActions.onToggleReference}
                onResourceDeleted={listActions.onResourceDeleted}
              />
            )
          ) : isGridLoading ? (
            (() => {
              const skeletonCount = resolveSkeletonCount(
                resolveResourceCenterCountKey(kbId, panel),
                2
              );
              return skeletonCount > 0
                ? <ResourceGridSkeleton cardCount={skeletonCount} />
                : <ResourceLoadingPlaceholder label="加载资源中..." />;
            })()
          ) : isGridError ? (
            <div className="text-sm text-rose-500">{gridErrorMessage}</div>
          ) : (
            <ResourceGrid
              items={gridItems}
              projectId={projectId}
              onOpen={listActions.onOpenResource}
              referencedDocIds={listActions.referencedDocIds}
              onToggleReference={listActions.onToggleReference}
              onResourceDeleted={listActions.onResourceDeleted}
            />
          )}
        </section>

        {showPagination ? (
          <div className="flex items-center justify-between text-xs text-slate-400">
            <button
              className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40 dark:border-[#2a2a2a]"
              disabled={page <= 1}
              onClick={() => listActions.onPageChange(panel, Math.max(1, page - 1))}
            >
              上一页
            </button>
            <span>第 {page} / {totalPages} 页</span>
            <button
              className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40 dark:border-[#2a2a2a]"
              disabled={page >= totalPages}
              onClick={() => listActions.onPageChange(panel, Math.min(totalPages, page + 1))}
            >
              下一页
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ResourceCenterListView;
