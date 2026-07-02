// useImagePreviewPagination.test.ts 负责验证图片预览分页 hook 的 query 配置与加载控制。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useInfiniteQuery: vi.fn(),
  fetchPreviewImagesPage: vi.fn(),
  revokeObjectURL: vi.fn(),
  setState: vi.fn(),
}));

vi.mock('react', () => ({
  useEffect: (effect: () => void | (() => void)) => {
    effect();
  },
  useMemo: (factory: () => unknown) => factory(),
  useRef: (value: unknown) => ({ current: value }),
  useState: (value: unknown) => [typeof value === 'function' ? (value as () => unknown)() : value, mocks.setState],
}));

vi.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: mocks.useInfiniteQuery,
}));

vi.mock('../../effects/previewImages', () => ({
  fetchPreviewImagesPage: mocks.fetchPreviewImagesPage,
}));

import { useImagePreviewPagination } from '../useImagePreviewPagination';

describe('useImagePreviewPagination', () => {
  beforeEach(() => {
    mocks.fetchPreviewImagesPage.mockReset();
    mocks.useInfiniteQuery.mockReset();
    mocks.revokeObjectURL.mockReset();
    mocks.setState.mockReset();
    vi.stubGlobal('URL', {
      revokeObjectURL: mocks.revokeObjectURL,
    });
    vi.stubGlobal('queueMicrotask', (callback: () => void) => callback());
  });

  it('会生成带 jump window 的 query 配置，并把返回结果转成 previewPages', async () => {
    mocks.useInfiniteQuery.mockImplementation((options) => ({
      ...options,
      data: {
        pages: [
          {
            items: [
              { pageNumber: 3, url: 'blob:3' },
              { pageNumber: 4, url: 'blob:4' },
              { pageNumber: 3, url: 'blob:dup' },
            ],
          },
        ],
      },
      hasNextPage: true,
      hasPreviousPage: false,
      isFetchingNextPage: false,
      isFetchingPreviousPage: false,
      fetchNextPage: vi.fn(),
      fetchPreviousPage: vi.fn(),
      isLoading: false,
      error: null,
    }));
    mocks.fetchPreviewImagesPage.mockResolvedValue({
      urls: ['blob:3', 'blob:4'],
      nextIndex: 5,
      hasMore: true,
    });

    const result = useImagePreviewPagination('doc-1', { enabled: true, jumpToPage: 8, jumpToken: 5, projectId: 'project-1' });

    const options = mocks.useInfiniteQuery.mock.calls[0][0];
    expect(options.queryKey).toEqual(['resource', 'preview-images', 'doc-1', 'project-1', 'jump-8-5']);
    expect(options.enabled).toBe(true);
    await expect(options.queryFn({ pageParam: 3 })).resolves.toEqual({
      items: [
        { pageNumber: 3, url: 'blob:3' },
        { pageNumber: 4, url: 'blob:4' },
      ],
      startIndex: 3,
      nextIndex: 5,
      hasMore: true,
    });
    expect(result.previewPages).toEqual([
      { pageNumber: 3, url: 'blob:3' },
      { pageNumber: 4, url: 'blob:4' },
    ]);
    expect(options.getPreviousPageParam({ startIndex: 8 })).toBe(1);
    expect(options.getNextPageParam({ hasMore: true, nextIndex: 20 })).toBe(20);
  });

  it('会使用 jump token 参与 queryKey，支持相同页码的重复跳转', () => {
    mocks.useInfiniteQuery.mockImplementation((options) => ({
      ...options,
      data: {
        pages: [
          {
            items: [
              { pageNumber: 1, url: 'blob:1' },
              { pageNumber: 2, url: 'blob:2' },
            ],
          },
        ],
      },
      hasNextPage: true,
      hasPreviousPage: false,
      isFetchingNextPage: false,
      isFetchingPreviousPage: false,
      fetchNextPage: vi.fn(),
      fetchPreviousPage: vi.fn(),
      isLoading: false,
      error: null,
    }));

    useImagePreviewPagination('doc-1', { enabled: true, jumpToPage: 15, jumpToken: 9, projectId: 'project-1' });

    const options = mocks.useInfiniteQuery.mock.calls[0][0];
    expect(options.queryKey).toEqual(['resource', 'preview-images', 'doc-1', 'project-1', 'jump-15-9']);
    expect(options.initialPageParam).toBe(10);
  });

  it('jump 参数清空后不会立刻把锚点重置回第一页', () => {
    mocks.useInfiniteQuery.mockImplementation((options) => ({
      ...options,
      data: {
        pages: [
          {
            items: [
              { pageNumber: 10, url: 'blob:10' },
              { pageNumber: 11, url: 'blob:11' },
            ],
          },
        ],
      },
      hasNextPage: true,
      hasPreviousPage: true,
      isFetchingNextPage: false,
      isFetchingPreviousPage: false,
      fetchNextPage: vi.fn(),
      fetchPreviousPage: vi.fn(),
      isLoading: false,
      error: null,
    }));

    useImagePreviewPagination('doc-1', { enabled: true, projectId: 'project-1' });

    const queuedSetters = mocks.setState.mock.calls
      .map(([value]) => value)
      .filter((value) => typeof value !== 'function');

    expect(queuedSetters).toEqual([]);
  });

  it('loadMore / loadPrevious 会在可加载时才触发', () => {
    const fetchNextPage = vi.fn();
    const fetchPreviousPage = vi.fn();
    mocks.useInfiniteQuery.mockImplementation((options) => ({
      ...options,
      data: undefined,
      hasNextPage: true,
      hasPreviousPage: false,
      isFetchingNextPage: false,
      isFetchingPreviousPage: true,
      fetchNextPage,
      fetchPreviousPage,
      isLoading: false,
      error: null,
    }));

    const result = useImagePreviewPagination('doc-1', { enabled: true, projectId: 'project-1' });
    result.loadMore();
    result.loadPrevious();

    expect(fetchNextPage).toHaveBeenCalledTimes(1);
    expect(fetchPreviousPage).not.toHaveBeenCalled();
  });

  it('目标页窗口为空但仍可向前探测时，会继续拉取上一批并暂不判失败', () => {
    const fetchPreviousPage = vi.fn();
    mocks.useInfiniteQuery.mockImplementation((options) => ({
      ...options,
      data: {
        pages: [
          {
            items: [],
            startIndex: 20,
            nextIndex: 20,
            hasMore: false,
          },
        ],
      },
      hasNextPage: false,
      hasPreviousPage: true,
      isFetchingNextPage: false,
      isFetchingPreviousPage: false,
      fetchNextPage: vi.fn(),
      fetchPreviousPage,
      isLoading: false,
      error: null,
    }));

    const result = useImagePreviewPagination('doc-1', { enabled: true, jumpToPage: 25, jumpToken: 2, projectId: 'project-1' });

    expect(fetchPreviousPage).toHaveBeenCalledTimes(1);
    expect(result.isJumpFailed).toBe(false);
  });

  it('已经探测到边界但仍未命中目标页时，会标记查询失败', () => {
    mocks.useInfiniteQuery.mockImplementation((options) => ({
      ...options,
      data: {
        pages: [
          {
            items: [
              { pageNumber: 1, url: 'blob:1' },
              { pageNumber: 2, url: 'blob:2' },
            ],
            startIndex: 1,
            nextIndex: 3,
            hasMore: false,
          },
        ],
      },
      hasNextPage: false,
      hasPreviousPage: false,
      isFetchingNextPage: false,
      isFetchingPreviousPage: false,
      fetchNextPage: vi.fn(),
      fetchPreviousPage: vi.fn(),
      isLoading: false,
      error: null,
    }));

    const result = useImagePreviewPagination('doc-1', { enabled: true, jumpToPage: 10, jumpToken: 3, projectId: 'project-1' });

    expect(result.isJumpFailed).toBe(true);
  });
});
