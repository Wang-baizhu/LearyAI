// TextPreview 负责文本类资源预览、滚动加载与段落定位。
import React, { useEffect, useRef, useState } from 'react';
import RichTextMarkdown from './RichTextMarkdown';
import {
  findNearestPreviewItemNumber,
  PREVIEW_VIEWPORT_TOP_OFFSET,
} from '../lib/previewViewportPosition';
import { useTextPreviewJump } from './useTextPreviewJump';

interface TextPreviewProps {
  chunks: Array<{ chunkSec: number; text: string }>;
  pageMarkerDocId?: string;
  jumpToChunk?: number;
  jumpToken?: number;
  onJumpHandled?: () => void;
  hasMore?: boolean;
  hasPrevious?: boolean;
  isLoadingMore?: boolean;
  isLoadingPrevious?: boolean;
  onLoadMore?: () => void;
  onLoadPrevious?: () => void;
  activeTimestampSeconds?: number | null;
  onTimestampClick?: (seconds: number) => void;
  maxHeightClassName?: string;
  onCitationClick?: (payload: { label: string; type: string; page: string; pageValue: string }) => void;
}

const TextPreview: React.FC<TextPreviewProps> = ({
  chunks,
  pageMarkerDocId,
  jumpToChunk,
  jumpToken,
  onJumpHandled,
  hasMore,
  hasPrevious,
  isLoadingMore,
  isLoadingPrevious,
  onLoadMore,
  onLoadPrevious,
  activeTimestampSeconds,
  onTimestampClick,
  maxHeightClassName = 'max-h-[70vh]',
  onCitationClick,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [allowPreviousAutoLoad, setAllowPreviousAutoLoad] = useState(!jumpToChunk);
  const [currentChunkSec, setCurrentChunkSec] = useState(chunks[0]?.chunkSec ?? 1);
  const lastScrollTopRef = useRef(0);
  const scrollDirectionRef = useRef<'up' | 'down' | null>(null);
  const effectiveCurrentChunkSec = chunks.some((item) => item.chunkSec === currentChunkSec)
    ? currentChunkSec
    : (chunks[0]?.chunkSec ?? 1);

  const syncCurrentChunkFromViewport = (container: HTMLDivElement) => {
    const nearestChunkSec = findNearestPreviewItemNumber(
      container,
      'chunkSec',
      PREVIEW_VIEWPORT_TOP_OFFSET
    );
    if (nearestChunkSec == null) {
      return;
    }
    setCurrentChunkSec(nearestChunkSec);
  };

  useTextPreviewJump({
    chunks,
    jumpToChunk,
    jumpToken,
    onJumpHandled,
    scrollContainerRef,
    setCurrentChunkSec,
  });

  useEffect(() => {
    if (!jumpToChunk) {
      const timer = window.setTimeout(() => setAllowPreviousAutoLoad(true), 0);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => setAllowPreviousAutoLoad(false), 0);
    return () => window.clearTimeout(timer);
  }, [jumpToChunk, jumpToken]);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (allowPreviousAutoLoad) return;
    const nativeEvent = event.nativeEvent as Event;
    if (!nativeEvent.isTrusted) return;
    setAllowPreviousAutoLoad(true);
  };

  const handleScrollDirection = (event: React.UIEvent<HTMLDivElement>) => {
    const nativeEvent = event.nativeEvent as Event;
    if (!nativeEvent.isTrusted) return;
    const container = event.currentTarget;
    syncCurrentChunkFromViewport(container);
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
  };

  return (
    <div className="relative h-full">
      <div className="pointer-events-none absolute right-3 top-3 z-20 rounded-full bg-slate-950/75 px-3 py-1.5 text-xs font-semibold text-white shadow-sm backdrop-blur sm:right-5 sm:top-5">
        Page {effectiveCurrentChunkSec}
      </div>
      <div
        ref={scrollContainerRef}
        onScroll={(event) => {
          handleScroll(event);
          handleScrollDirection(event);
        }}
        className={`bg-transparent overflow-y-auto custom-scrollbar ${maxHeightClassName}`}
      >
        <div className="flex flex-col gap-6">
          <div className="flex h-12 items-center justify-center text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-[#a0a0a0]">
            {hasPrevious ? (isLoadingPrevious ? '正在加载上一批...' : '上滑加载更多') : '已到开头'}
          </div>
          {chunks.map(({ chunkSec, text }) => {
            return (
              <div
                key={chunkSec}
                data-chunk-sec={chunkSec}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a2a] dark:bg-[#161616]"
              >
                <RichTextMarkdown
                  text={text}
                  className="text-sm leading-6 text-slate-700 dark:text-slate-200"
                  pageMarkerDocId={pageMarkerDocId}
                  activeSeconds={activeTimestampSeconds}
                  onTimestampClick={onTimestampClick}
                  onCitationClick={onCitationClick}
                />
              </div>
            );
          })}
          <div className="flex h-12 items-center justify-center text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-[#a0a0a0]">
            {hasMore ? (isLoadingMore ? '正在加载更多...' : '滚动加载更多') : '已加载全部'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TextPreview;
