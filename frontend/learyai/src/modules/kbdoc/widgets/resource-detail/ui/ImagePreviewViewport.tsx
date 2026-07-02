// ImagePreviewViewport 负责图片预览的滚动、跳页与全屏装配。
import React from 'react';
import ImagePreviewFullscreen from './ImagePreviewFullscreen';
import ImagePreviewPageList from './ImagePreviewPageList';
import { findNearestPreviewPageNumber } from '../lib/imagePreviewViewportPosition';
import { useImagePreviewJump } from './useImagePreviewJump';

interface ImagePreviewViewportProps {
  pages: Array<{ pageNumber: number; url: string }>;
  jumpToPage?: number;
  jumpToken?: number;
  onJumpHandled?: () => void;
  hasMore?: boolean;
  hasPrevious?: boolean;
  isLoadingMore?: boolean;
  isLoadingPrevious?: boolean;
  onLoadMore?: () => void;
  onLoadPrevious?: () => void;
  viewportClassName?: string;
}

const ImagePreviewViewport: React.FC<ImagePreviewViewportProps> = ({
  pages,
  jumpToPage,
  jumpToken,
  onJumpHandled,
  hasMore,
  hasPrevious,
  isLoadingMore,
  isLoadingPrevious,
  onLoadMore,
  onLoadPrevious,
  viewportClassName = 'max-h-[70vh]',
}) => {
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const lastScrollTopRef = React.useRef(0);
  const scrollDirectionRef = React.useRef<'up' | 'down' | null>(null);
  const [allowPreviousAutoLoad, setAllowPreviousAutoLoad] = React.useState(!jumpToPage);
  const [fullscreenPageNumber, setFullscreenPageNumber] = React.useState<number | null>(null);
  const [currentPageNumber, setCurrentPageNumber] = React.useState<number>(pages[0]?.pageNumber ?? 1);
  const effectiveCurrentPageNumber = pages.some((page) => page.pageNumber === currentPageNumber)
    ? currentPageNumber
    : (pages[0]?.pageNumber ?? 1);
  const activeFullscreenPageNumber = fullscreenPageNumber == null
    ? null
    : (jumpToPage && pages.some((page) => page.pageNumber === jumpToPage) ? jumpToPage : fullscreenPageNumber);
  const activeFullscreenPage = activeFullscreenPageNumber == null
    ? null
    : (pages.find((page) => page.pageNumber === activeFullscreenPageNumber) ?? null);

  const syncCurrentPageFromViewport = React.useCallback((container: HTMLDivElement) => {
    const nearestPageNumber = findNearestPreviewPageNumber(container);
    if (nearestPageNumber == null) {
      return;
    }
    setCurrentPageNumber(nearestPageNumber);
  }, []);

  useImagePreviewJump({
    jumpToPage,
    jumpToken,
    onJumpHandled,
    pages,
    scrollContainerRef,
    setCurrentPageNumber,
  });

  const handleScroll = React.useCallback((event: React.UIEvent<HTMLDivElement>) => {
    if (!allowPreviousAutoLoad) {
      const nativeEvent = event.nativeEvent as Event;
      if (nativeEvent.isTrusted) {
        setAllowPreviousAutoLoad(true);
      }
    }

    const nativeEvent = event.nativeEvent as Event;
    if (!nativeEvent.isTrusted) {
      return;
    }
    const container = event.currentTarget;
    syncCurrentPageFromViewport(container);
    const currentTop = container.scrollTop;
    const lastTop = lastScrollTopRef.current;
    if (currentTop > lastTop) {
      scrollDirectionRef.current = 'down';
    } else if (currentTop < lastTop) {
      scrollDirectionRef.current = 'up';
    }
    lastScrollTopRef.current = currentTop;
    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const nearTop = container.scrollTop <= 160;
    const nearBottom = distanceToBottom <= 160;
    if (scrollDirectionRef.current === 'down' && nearBottom && hasMore && !isLoadingMore) {
      onLoadMore?.();
    }
    if (
      scrollDirectionRef.current === 'up'
      && nearTop
      && allowPreviousAutoLoad
      && hasPrevious
      && !isLoadingPrevious
    ) {
      onLoadPrevious?.();
    }
  }, [
    allowPreviousAutoLoad,
    hasMore,
    hasPrevious,
    isLoadingMore,
    isLoadingPrevious,
    onLoadMore,
    onLoadPrevious,
    syncCurrentPageFromViewport,
  ]);

  return (
    <>
      <div className="relative h-full">
        <div className="pointer-events-none absolute right-3 top-3 z-20 rounded-full bg-slate-950/75 px-3 py-1.5 text-xs font-semibold text-white shadow-sm backdrop-blur sm:right-5 sm:top-5">
          Page {effectiveCurrentPageNumber}
        </div>
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className={`${viewportClassName} overflow-y-auto bg-transparent p-0 custom-scrollbar`}
        >
          <ImagePreviewPageList
            hasMore={hasMore}
            hasPrevious={hasPrevious}
            isLoadingMore={isLoadingMore}
            isLoadingPrevious={isLoadingPrevious}
            jumpToPage={jumpToPage}
            onOpenFullscreen={(pageNumber) => {
              setCurrentPageNumber(pageNumber);
              setFullscreenPageNumber(pageNumber);
            }}
            pages={pages}
          />
        </div>
      </div>
      {activeFullscreenPage ? (
        <ImagePreviewFullscreen
          key={activeFullscreenPage.pageNumber}
          page={activeFullscreenPage}
          onClose={() => setFullscreenPageNumber(null)}
        />
      ) : null}
    </>
  );
};

export default ImagePreviewViewport;
