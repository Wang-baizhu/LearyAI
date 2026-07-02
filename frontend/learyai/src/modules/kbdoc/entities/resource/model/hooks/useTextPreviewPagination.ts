// useTextPreviewPagination 负责管理文档文本分块分页与跳转加载。
import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchTextChunksPage, type TextChunkItem } from '../effects/textChunks';

const PAGE_SIZE = 10;
const JUMP_WINDOW_RADIUS = 5;

interface TextChunkPageChunk {
  items: TextChunkItem[];
  startChunkSec: number;
  nextChunkSec: number;
  hasMore: boolean;
}

interface UseTextPreviewPaginationOptions {
  enabled?: boolean;
  jumpToChunk?: number;
  jumpToken?: number;
  projectId?: string;
}

interface TextQueryAnchor {
  startChunkSec: number;
  pageSize: number;
  key: string;
}

const DEFAULT_TEXT_QUERY_ANCHOR: TextQueryAnchor = {
  startChunkSec: 1,
  pageSize: PAGE_SIZE,
  key: 'default',
};

const buildTextQueryAnchor = (jumpToChunk?: number, jumpToken?: number): TextQueryAnchor => {
  if (!jumpToChunk) {
    return DEFAULT_TEXT_QUERY_ANCHOR;
  }
  return {
    startChunkSec: Math.max(1, jumpToChunk - JUMP_WINDOW_RADIUS),
    pageSize: JUMP_WINDOW_RADIUS * 2 + 1,
    key: `jump-${jumpToChunk}-${jumpToken ?? 'no-token'}`,
  };
};

export const useTextPreviewPagination = (
  docId?: string | null,
  options: UseTextPreviewPaginationOptions = {}
) => {
  const { enabled = false, jumpToChunk, jumpToken } = options;
  const [queryAnchor, setQueryAnchor] = useState<TextQueryAnchor>(() => buildTextQueryAnchor(jumpToChunk, jumpToken));
  const lastDocIdRef = useRef<string | null | undefined>(docId);
  const lastJumpTokenRef = useRef<number | undefined>(jumpToken);
  const previewQuery = useInfiniteQuery({
    queryKey: ['resource', 'text-chunks', docId, options.projectId ?? 'none', queryAnchor.key],
    enabled: Boolean(docId) && enabled,
    initialPageParam: queryAnchor.startChunkSec,
    gcTime: 0,
    refetchOnMount: 'always',
    queryFn: ({ pageParam }) => {
      if (!docId) {
        throw new Error('缺少 docId，无法加载文本分块');
      }
      const pageSize = pageParam === queryAnchor.startChunkSec ? queryAnchor.pageSize : PAGE_SIZE;
      return fetchTextChunksPage(docId, pageParam, pageSize, options.projectId).then<TextChunkPageChunk>((chunk) => ({
        items: chunk.items ?? [],
        startChunkSec: pageParam,
        nextChunkSec: chunk.nextChunkSec,
        hasMore: chunk.hasMore,
      }));
    },
    getPreviousPageParam: (firstPage) => {
      const firstLoaded = firstPage.startChunkSec;
      if (firstLoaded <= 1) return undefined;
      return Math.max(1, firstLoaded - PAGE_SIZE);
    },
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextChunkSec : undefined),
  });

  useEffect(() => {
    if (docId === lastDocIdRef.current) return;
    lastDocIdRef.current = docId;
    lastJumpTokenRef.current = jumpToken;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setQueryAnchor(buildTextQueryAnchor(jumpToChunk, jumpToken));
    });
    return () => {
      cancelled = true;
    };
  }, [docId, jumpToChunk, jumpToken]);

  useEffect(() => {
    if (!jumpToChunk || jumpToken == null) return;
    if (jumpToken === lastJumpTokenRef.current) return;
    lastJumpTokenRef.current = jumpToken;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setQueryAnchor(buildTextQueryAnchor(jumpToChunk, jumpToken));
    });
    return () => {
      cancelled = true;
    };
  }, [jumpToChunk, jumpToken]);

  const textChunks = useMemo(
    () => {
      const chunkMap = new Map<number, TextChunkItem>();
      const flatItems = previewQuery.data?.pages.flatMap((page) => page.items) ?? [];
      for (const item of flatItems) {
        if (!chunkMap.has(item.chunkSec)) {
          chunkMap.set(item.chunkSec, item);
        }
      }
      return [...chunkMap.values()].sort((a, b) => a.chunkSec - b.chunkSec);
    },
    [previewQuery.data]
  );

  const {
    data,
    hasNextPage,
    hasPreviousPage,
    isFetchingNextPage,
    isFetchingPreviousPage,
    fetchNextPage,
    fetchPreviousPage,
    isLoading,
    error,
  } = previewQuery;

  useEffect(() => {
    if (!jumpToChunk) return;
    if (!data) return;
    if (!textChunks.length) {
      if (hasPreviousPage && !isFetchingPreviousPage) {
        void fetchPreviousPage();
      }
      return;
    }
    const minLoaded = textChunks[0]?.chunkSec ?? 1;
    const maxLoaded = textChunks[textChunks.length - 1]?.chunkSec ?? minLoaded;
    if (jumpToChunk < minLoaded) {
      if (!hasPreviousPage || isFetchingPreviousPage) return;
      void fetchPreviousPage();
      return;
    }
    if (jumpToChunk > maxLoaded) {
      if (!hasNextPage || isFetchingNextPage) return;
      void fetchNextPage();
    }
  }, [
    data,
    fetchNextPage,
    fetchPreviousPage,
    hasNextPage,
    hasPreviousPage,
    isFetchingNextPage,
    isFetchingPreviousPage,
    jumpToChunk,
    textChunks,
  ]);

  const isJumpFailed = useMemo(() => {
    if (!jumpToChunk) return false;
    if (isLoading || isFetchingNextPage || isFetchingPreviousPage) return false;
    if (textChunks.length === 0) {
      return !hasNextPage && !hasPreviousPage;
    }
    const minLoaded = textChunks[0]?.chunkSec ?? 1;
    const maxLoaded = textChunks[textChunks.length - 1]?.chunkSec ?? minLoaded;
    if (jumpToChunk < minLoaded && !hasPreviousPage) {
      return true;
    }
    if (jumpToChunk > maxLoaded && !hasNextPage) {
      return true;
    }
    return false;
  }, [
    hasNextPage,
    hasPreviousPage,
    isFetchingNextPage,
    isFetchingPreviousPage,
    isLoading,
    jumpToChunk,
    textChunks,
  ]);

  return {
    textChunks,
    isLoading,
    isLoadingMore: isFetchingNextPage,
    isLoadingPrevious: isFetchingPreviousPage,
    hasMore: hasNextPage,
    hasPrevious: hasPreviousPage,
    isJumpFailed,
    error,
    loadMore: () => {
      if (!hasNextPage || isFetchingNextPage) return;
      void fetchNextPage();
    },
    loadPrevious: () => {
      if (!hasPreviousPage || isFetchingPreviousPage) return;
      void fetchPreviousPage();
    },
  };
};
