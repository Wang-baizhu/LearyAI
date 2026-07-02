// KnowledgeBaseOverview 负责展示最近访问内容列表与筛选交互。
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import type { RecentVisitItem, RecentVisitPage } from '../../../../visit';
import { formatVisitedAt } from '@/shared/lib/formatters';
import { resolveApiErrorMessage } from '@/shared/api/resolveApiError';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';
import SkeletonLoader from '@/shared/ui/SkeletonLoader';
import { safeLocalStorageGet, safeLocalStorageSet } from '@/shared/lib/safeLocalStorage';
import { TourStep } from '@leary/tour-guide';

const WORKSPACE_TOUR_TAG = 'workspace-quick-start-v1';

interface KnowledgeBaseOverviewProps {
  query: UseInfiniteQueryResult<InfiniteData<RecentVisitPage, unknown>, Error>;
  statusText?: string | null;
  onVisit: (item: RecentVisitItem) => void;
}

const KNOWLEDGE_BASE_COUNT_STORAGE_KEY = 'workspace:knowledge-base:list-count';
const readPersistedCount = (key: string): number => {
  const raw = safeLocalStorageGet(key);
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(Math.floor(parsed), 12);
};
const persistCount = (key: string, count: number) => {
  if (!Number.isFinite(count) || count < 0) return;
  safeLocalStorageSet(key, String(Math.floor(count)));
};

const KnowledgeBaseOverview: React.FC<KnowledgeBaseOverviewProps> = ({
  query,
  statusText = null,
  onVisit,
}) => {
  const [search, setSearch] = useState('');
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const items = useMemo(
    () => query.data?.pages.flatMap((page) => page.items ?? []) ?? [],
    [query.data]
  );
  const errorMessage = query.isError
    ? resolveApiErrorMessage(query.error, '加载失败，请稍后重试')
    : null;

  const filteredItems = useMemo(() => {
    if (!search.trim()) {
      return items;
    }
    const keyword = search.trim().toLowerCase();
    return items.filter((item) => (item.title ?? '').toLowerCase().includes(keyword));
  }, [items, search]);
  const subtitleText = statusText ?? '查看最近聚焦的内容。';
  const knowledgeBaseSkeletonCount = readPersistedCount(KNOWLEDGE_BASE_COUNT_STORAGE_KEY);
  const isKnowledgeBaseLoading = query.isLoading || query.isPending || (query.isFetching && items.length === 0);
  const typeLabelMap = {
    PROJECT: '空间',
    KB: '知识库',
  } as const;
  const typeIconMap = {
    PROJECT: 'folder',
    KB: 'menu_book',
  } as const;

  useEffect(() => {
    if (!query.isSuccess) return;
    if (items.length <= 0) return;
    persistCount(KNOWLEDGE_BASE_COUNT_STORAGE_KEY, items.length);
  }, [items.length, query.isSuccess]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !query.hasNextPage) {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (!entry?.isIntersecting || query.isFetchingNextPage) {
        return;
      }
      void query.fetchNextPage();
    }, { rootMargin: '120px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [query, query.fetchNextPage, query.hasNextPage, query.isFetchingNextPage]);

  const containerNode = (
    <section className="bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] rounded-2xl p-6 h-full">
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-slate-900 dark:text-[#e0e0e0]">最近内容</h3>
          <p className="text-sm text-slate-500 dark:text-[#a0a0a0]">{subtitleText}</p>
        </div>
        <div className="relative w-full sm:ml-auto sm:w-64">
          <MaterialIcon
            name="search"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#a0a0a0] text-base"
          />
          <input
            className="w-full pl-10 pr-3 py-2 rounded-2xl border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a] text-sm text-slate-700 dark:text-[#e0e0e0] focus:outline-none focus:ring-1 focus:ring-accent caret-accent transition-all"
            placeholder="搜索最近内容"
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      <div className="max-h-[520px] overflow-y-auto pr-1 space-y-4">
        {isKnowledgeBaseLoading ? (
          knowledgeBaseSkeletonCount > 0 ? (
            <div className="space-y-4">
              {Array.from({ length: knowledgeBaseSkeletonCount }).map((_, index) => (
                <div
                  key={`knowledge-base-skeleton-${index}`}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-5 dark:border-[#2a2a2a] dark:bg-[#121212]/60"
                >
                  <div className="flex-1">
                    <SkeletonLoader
                      barCount={3}
                      maxWidths={['56%', '82%', '22%']}
                      delayBase={100}
                      className="max-w-[360px]"
                    />
                  </div>
                  <div className="w-[120px]">
                    <SkeletonLoader
                      barCount={2}
                      maxWidths={['62%', '92%']}
                      delayBase={90}
                      className="ml-auto items-end"
                    />
                  </div>
                  <div className="size-5 rounded-full bg-slate-200/70 dark:bg-slate-700/50 animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center text-slate-400 dark:text-[#a0a0a0]">加载中...</div>
          )
        ) : filteredItems.length > 0 ? (
          filteredItems.map((item) => (
            <div
              key={`${item.resourceType}:${item.resourceId}`}
              className="group flex cursor-pointer flex-col gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-5 transition-colors hover:border-slate-300 dark:border-[#2a2a2a] dark:bg-[#121212]/60 dark:hover:border-[#444] sm:flex-row sm:items-center sm:justify-between"
              role="button"
              onClick={() => onVisit(item)}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] flex items-center justify-center shrink-0">
                    <MaterialIcon
                      name={typeIconMap[item.resourceType] ?? 'description'}
                      className="text-slate-500 dark:text-[#a0a0a0] text-sm"
                    />
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-[#e0e0e0] leading-6 break-words">
                    {item.title ?? '内容已不可用'}
                  </p>
                </div>
                <p className="mt-1.5 text-xs text-slate-500 dark:text-[#a0a0a0] leading-5 break-words">
                  {(item.description
                    ? `${item.description.slice(0, 24)}${item.description.length > 24 ? '...' : ''}`
                    : item.available
                      ? '暂无描述'
                      : '该内容已不可访问或已删除')}{' '}
                    · {typeLabelMap[item.resourceType] ?? item.resourceType}
                </p>
              </div>
              <div className="flex w-full items-center justify-between gap-3 border-t border-slate-200/70 pt-3 dark:border-[#2a2a2a] sm:w-auto sm:min-w-[140px] sm:border-t-0 sm:pt-0">
                <div className="min-w-0 sm:text-right">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-[#a0a0a0]">访问时间</p>
                  <p className="truncate text-xs font-bold text-slate-600 dark:text-[#e0e0e0]">
                    {formatVisitedAt(item.visitedAt)}
                  </p>
                </div>
                <div className="shrink-0">
                  <div className="flex items-center gap-1 text-primary opacity-0 transition-all duration-300 translate-x-3 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 dark:text-[#8fd3ca]">
                    <span className="text-[10px] font-black uppercase tracking-widest">查看详情</span>
                    <MaterialIcon
                      name="east"
                      className="text-sm transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : query.isError ? (
          <div className="py-10 text-center text-slate-400 dark:text-[#a0a0a0]">{errorMessage ?? '加载失败'}</div>
        ) : (
          <div className="py-10 text-center text-slate-400 dark:text-[#a0a0a0]">还没有最近聚焦的内容</div>
        )}
        {!isKnowledgeBaseLoading && items.length > 0 ? (
          <div ref={loadMoreRef} className="py-4 text-center text-xs text-slate-400 dark:text-[#a0a0a0]">
            {query.isFetchingNextPage
              ? '正在加载更多...'
              : query.hasNextPage
                ? '滚动加载更多'
                : '已加载全部'}
          </div>
        ) : null}
      </div>
    </section>
  );

  return (
    <TourStep
      tag={WORKSPACE_TOUR_TAG}
      order={3}
      title="最近内容"
      content="该区域展示最近聚焦的内容，通过此处入口您可以快速回到最近访问的空间或知识库。"
    >
      {containerNode}
    </TourStep>
  );
};

export default KnowledgeBaseOverview;
