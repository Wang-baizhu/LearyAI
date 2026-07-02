// useImagePreviewPagination 负责管理文档预览图片分页与跳页加载。
import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchPreviewImagesPage } from '../effects/previewImages';

const PAGE_SIZE = 10;
const JUMP_WINDOW_RADIUS = 5;

interface PreviewPageItem {
  pageNumber: number;
  url: string;
}

interface PreviewPageChunk {
  items: PreviewPageItem[];
  startIndex: number;
  nextIndex: number;
  hasMore: boolean;
}

interface UseImagePreviewPaginationOptions {
  enabled?: boolean;
  jumpToPage?: number;
  jumpToken?: number;
  projectId?: string;
}

interface PreviewQueryAnchor {
  startIndex: number;
  pageSize: number;
  key: string;
}

const DEFAULT_PREVIEW_QUERY_ANCHOR: PreviewQueryAnchor = {
  startIndex: 1,
  pageSize: PAGE_SIZE,
  key: 'default',
};

const buildPreviewQueryAnchor = (jumpToPage?: number, jumpToken?: number): PreviewQueryAnchor => {
  if (!jumpToPage) {
    return DEFAULT_PREVIEW_QUERY_ANCHOR;
  }
  return {
    startIndex: Math.max(1, jumpToPage - JUMP_WINDOW_RADIUS),
    pageSize: JUMP_WINDOW_RADIUS * 2 + 1,
    key: `jump-${jumpToPage}-${jumpToken ?? 'no-token'}`,
  };
};

export const useImagePreviewPagination = (
  docId?: string | null,
  options: UseImagePreviewPaginationOptions = {}
) => {
  const previewImagesRef = useRef<string[]>([]);
  const { enabled = false, jumpToPage, jumpToken } = options;
  const [queryAnchor, setQueryAnchor] = useState<PreviewQueryAnchor>(() => buildPreviewQueryAnchor(jumpToPage, jumpToken));
  const lastDocIdRef = useRef<string | null | undefined>(docId);
  const lastJumpTokenRef = useRef<number | undefined>(jumpToken);
  const previewQuery = useInfiniteQuery({
    queryKey: ['resource', 'preview-images', docId, options.projectId ?? 'none', queryAnchor.key],
    enabled: Boolean(docId) && enabled,
    initialPageParam: queryAnchor.startIndex,
    gcTime: 0,
    refetchOnMount: 'always',
    queryFn: ({ pageParam }) => {
      if (!docId) {
        throw new Error('缺少 docId，无法加载预览图');
      }
      const pageSize = pageParam === queryAnchor.startIndex ? queryAnchor.pageSize : PAGE_SIZE;
      return fetchPreviewImagesPage(docId, pageParam, pageSize, options.projectId).then<PreviewPageChunk>((chunk) => ({
        items: chunk.urls.map((url, index) => ({
          pageNumber: pageParam + index,
          url,
        })),
        startIndex: pageParam,
        nextIndex: chunk.nextIndex,
        hasMore: chunk.hasMore,
      }));
    },
    getPreviousPageParam: (firstPage) => {
      const firstLoaded = firstPage.startIndex;
      if (firstLoaded <= 1) return undefined;
      return Math.max(1, firstLoaded - PAGE_SIZE);
    },
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextIndex : undefined),
  });
  const previewPages = useMemo(
    () => {
      const pageMap = new Map<number, PreviewPageItem>();
      const flatItems = previewQuery.data?.pages.flatMap((page) => page.items) ?? [];
      for (const item of flatItems) {
        if (!pageMap.has(item.pageNumber)) {
          pageMap.set(item.pageNumber, item);
        }
      }
      return [...pageMap.values()].sort((a, b) => a.pageNumber - b.pageNumber);
    },
    [previewQuery.data]
  );

  useEffect(() => {
    if (docId === lastDocIdRef.current) return;
    lastDocIdRef.current = docId;
    lastJumpTokenRef.current = jumpToken;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setQueryAnchor(buildPreviewQueryAnchor(jumpToPage, jumpToken));
    });
    return () => {
      cancelled = true;
    };
  }, [docId, jumpToPage, jumpToken]);

  useEffect(() => {
    if (!jumpToPage || jumpToken == null) return;
    if (jumpToken === lastJumpTokenRef.current) return;
    lastJumpTokenRef.current = jumpToken;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      // 同文档二次跳页时，当前缓存页可能不包含目标页；这里要重建查询锚点，
      // 让 infinite query 从目标页附近重新起跳，而不是继续沿旧窗口被动翻页。
      setQueryAnchor(buildPreviewQueryAnchor(jumpToPage, jumpToken));
    });
    return () => {
      cancelled = true;
    };
  }, [jumpToPage, jumpToken]);

  useEffect(() => {
    const previous = previewImagesRef.current;
    const currentSet = new Set(previewPages.map((item) => item.url));
    previous.forEach((url) => {
      if (!currentSet.has(url)) {
        URL.revokeObjectURL(url);
      }
    });
    previewImagesRef.current = previewPages.map((item) => item.url);
  }, [previewPages]);

  useEffect(() => {
    return () => {
      previewImagesRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

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
    if (!jumpToPage) return;
    if (!data) return;
    if (!previewPages.length) {
      if (hasPreviousPage && !isFetchingPreviousPage) {
        void fetchPreviousPage();
      }
      return;
    }
    const minLoaded = previewPages[0]?.pageNumber ?? 1;
    const maxLoaded = previewPages[previewPages.length - 1]?.pageNumber ?? minLoaded;
    if (jumpToPage < minLoaded) {
      if (!hasPreviousPage || isFetchingPreviousPage) return;
      void fetchPreviousPage();
      return;
    }
    if (jumpToPage > maxLoaded) {
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
    jumpToPage,
    previewPages,
  ]);

  const isJumpFailed = useMemo(() => {
    if (!jumpToPage) return false;
    if (isLoading || isFetchingNextPage || isFetchingPreviousPage) return false;
    if (previewPages.length === 0) {
      return !hasNextPage && !hasPreviousPage;
    }
    const minLoaded = previewPages[0]?.pageNumber ?? 1;
    const maxLoaded = previewPages[previewPages.length - 1]?.pageNumber ?? minLoaded;
    if (jumpToPage < minLoaded && !hasPreviousPage) {
      return true;
    }
    if (jumpToPage > maxLoaded && !hasNextPage) {
      return true;
    }
    return false;
  }, [
    hasNextPage,
    hasPreviousPage,
    isFetchingNextPage,
    isFetchingPreviousPage,
    isLoading,
    jumpToPage,
    previewPages,
  ]);

  return {
    previewPages,
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
