// ImagePreviewPageList 负责渲染可滚动图片页列表与全屏入口按钮。
import React from 'react';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';

interface ImagePreviewPageListProps {
  hasMore?: boolean;
  hasPrevious?: boolean;
  isLoadingMore?: boolean;
  isLoadingPrevious?: boolean;
  jumpToPage?: number;
  onOpenFullscreen: (pageNumber: number, url: string) => void;
  pages: Array<{ pageNumber: number; url: string }>;
}

const ImagePreviewPageList: React.FC<ImagePreviewPageListProps> = ({
  hasMore,
  hasPrevious,
  isLoadingMore,
  isLoadingPrevious,
  jumpToPage,
  onOpenFullscreen,
  pages,
}) => (
  <div className="flex flex-col items-center">
    <div className="flex h-12 items-center justify-center text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-[#a0a0a0]">
      {hasPrevious ? (isLoadingPrevious ? '正在加载上一批...' : '上滑加载更多') : '已到开头'}
    </div>
    {pages.map(({ pageNumber, url }) => (
      <div
        key={url}
        data-page-number={pageNumber}
        className="group relative mb-8 flex w-full flex-col items-center"
      >
        <button
          type="button"
          onClick={() => onOpenFullscreen(pageNumber, url)}
          className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm transition hover:text-primary dark:bg-[#0f172a]/90 dark:text-[#d0d0d0] lg:right-3 lg:top-3"
          aria-label={`全屏查看第 ${pageNumber} 页`}
        >
          <MaterialIcon name="open_in_full" className="text-sm" />
          <span className="hidden sm:inline">全屏</span>
        </button>
        <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-[#2a2a2a] lg:w-auto">
          <img
            src={url}
            alt={`page-${pageNumber}`}
            className="w-full max-w-full cursor-zoom-in lg:w-auto"
            // 跳页时需优先加载目标页及其前置页，避免高度未稳定导致定位偏移。
            loading={jumpToPage != null && pageNumber <= jumpToPage ? 'eager' : 'lazy'}
          />
        </div>
      </div>
    ))}
    <div className="flex h-12 items-center justify-center text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-[#a0a0a0]">
      {hasMore ? (isLoadingMore ? '正在加载更多...' : '滚动加载更多') : '已加载全部'}
    </div>
  </div>
);

export default ImagePreviewPageList;
