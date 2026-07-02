// useTextPreviewPagination.test.ts 负责验证文本预览分页 hook 的 query 配置与加载控制。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useInfiniteQuery: vi.fn(),
  fetchTextChunksPage: vi.fn(),
  hookState: {
    value: undefined as unknown,
    setter: vi.fn(),
  },
  refs: [] as Array<{ current: unknown }>,
}));

vi.mock('react', () => ({
  useEffect: (effect: () => void | (() => void)) => {
    effect();
  },
  useMemo: (factory: () => unknown) => factory(),
  useRef: (value: unknown) => {
    const ref = { current: value };
    mocks.refs.push(ref);
    return ref;
  },
  useState: (initial: unknown) => {
    if (mocks.hookState.value === undefined) {
      mocks.hookState.value = typeof initial === 'function' ? initial() : initial;
    }
    return [
      mocks.hookState.value,
      mocks.hookState.setter.mockImplementation((nextValue: unknown) => {
        mocks.hookState.value = typeof nextValue === 'function'
          ? (nextValue as (previous: unknown) => unknown)(mocks.hookState.value)
          : nextValue;
      }),
    ];
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: mocks.useInfiniteQuery,
}));

vi.mock('../../effects/textChunks', () => ({
  fetchTextChunksPage: mocks.fetchTextChunksPage,
}));

import { useTextPreviewPagination } from '../useTextPreviewPagination';

describe('useTextPreviewPagination', () => {
  beforeEach(() => {
    mocks.fetchTextChunksPage.mockReset();
    mocks.useInfiniteQuery.mockReset();
    mocks.hookState.value = undefined;
    mocks.hookState.setter.mockReset();
    mocks.refs.length = 0;
  });

  it('会构造基于 jumpToChunk 的 query，并去重 chunkSec', async () => {
    mocks.useInfiniteQuery.mockImplementation((options) => ({
      ...options,
      data: {
        pages: [
          {
            items: [
              { chunkSec: 5, text: 'a' },
              { chunkSec: 6, text: 'b' },
              { chunkSec: 5, text: 'dup' },
            ],
          },
        ],
      },
      hasNextPage: false,
      hasPreviousPage: true,
      isFetchingNextPage: false,
      isFetchingPreviousPage: false,
      fetchNextPage: vi.fn(),
      fetchPreviousPage: vi.fn(),
      isLoading: false,
      error: null,
    }));
    mocks.fetchTextChunksPage.mockResolvedValue({
      items: [
        { chunkSec: 5, text: 'a' },
        { chunkSec: 6, text: 'b' },
      ],
      nextChunkSec: 7,
      hasMore: true,
    });

    const result = useTextPreviewPagination('doc-1', { enabled: true, jumpToChunk: 10, projectId: 'project-1' });
    const options = mocks.useInfiniteQuery.mock.calls[0][0];

    expect(options.queryKey).toEqual(['resource', 'text-chunks', 'doc-1', 'project-1', 'jump-10-no-token']);
    await expect(options.queryFn({ pageParam: 5 })).resolves.toEqual({
      items: [
        { chunkSec: 5, text: 'a' },
        { chunkSec: 6, text: 'b' },
      ],
      startChunkSec: 5,
      nextChunkSec: 7,
      hasMore: true,
    });
    expect(result.textChunks).toEqual([
      { chunkSec: 5, text: 'a' },
      { chunkSec: 6, text: 'b' },
    ]);
    expect(options.getPreviousPageParam({ startChunkSec: 8 })).toBe(1);
    expect(options.getNextPageParam({ hasMore: false, nextChunkSec: 20 })).toBeUndefined();
  });

  it('loadMore / loadPrevious 会遵循分页状态', () => {
    const fetchNextPage = vi.fn();
    const fetchPreviousPage = vi.fn();
    mocks.useInfiniteQuery.mockImplementation((options) => ({
      ...options,
      data: undefined,
      hasNextPage: false,
      hasPreviousPage: true,
      isFetchingNextPage: false,
      isFetchingPreviousPage: false,
      fetchNextPage,
      fetchPreviousPage,
      isLoading: false,
      error: null,
    }));

    const result = useTextPreviewPagination('doc-1', { enabled: true, projectId: 'project-1' });
    result.loadMore();
    result.loadPrevious();

    expect(fetchNextPage).not.toHaveBeenCalled();
    expect(fetchPreviousPage).toHaveBeenCalledTimes(1);
  });

  it('目标分块窗口为空但仍可向前探测时，会继续拉取上一批并暂不判失败', () => {
    const fetchPreviousPage = vi.fn();
    mocks.useInfiniteQuery.mockImplementation((options) => ({
      ...options,
      data: {
        pages: [
          {
            items: [],
            startChunkSec: 20,
            nextChunkSec: 20,
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

    const result = useTextPreviewPagination('doc-1', { enabled: true, jumpToChunk: 25, projectId: 'project-1' });

    expect(fetchPreviousPage).toHaveBeenCalledTimes(1);
    expect(result.isJumpFailed).toBe(false);
  });

  it('已经探测到边界但仍未命中目标分块时，会标记查询失败', () => {
    mocks.useInfiniteQuery.mockImplementation((options) => ({
      ...options,
      data: {
        pages: [
          {
            items: [
              { chunkSec: 1, text: 'a' },
              { chunkSec: 2, text: 'b' },
            ],
            startChunkSec: 1,
            nextChunkSec: 3,
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

    const result = useTextPreviewPagination('doc-1', { enabled: true, jumpToChunk: 10, projectId: 'project-1' });

    expect(result.isJumpFailed).toBe(true);
  });

  it('清理跳转参数后会保留最近一次跳转锚点，而不是切回 default 查询', () => {
    mocks.useInfiniteQuery.mockImplementation((options) => ({
      ...options,
      data: undefined,
      hasNextPage: false,
      hasPreviousPage: false,
      isFetchingNextPage: false,
      isFetchingPreviousPage: false,
      fetchNextPage: vi.fn(),
      fetchPreviousPage: vi.fn(),
      isLoading: false,
      error: null,
    }));

    useTextPreviewPagination('doc-1', { enabled: true, jumpToChunk: 18, jumpToken: 7, projectId: 'project-1' });
    const firstOptions = mocks.useInfiniteQuery.mock.calls.at(-1)?.[0];

    expect(firstOptions.queryKey).toEqual(['resource', 'text-chunks', 'doc-1', 'project-1', 'jump-18-7']);

    useTextPreviewPagination('doc-1', { enabled: true, projectId: 'project-1' });
    const secondOptions = mocks.useInfiniteQuery.mock.calls.at(-1)?.[0];

    expect(secondOptions.queryKey).toEqual(['resource', 'text-chunks', 'doc-1', 'project-1', 'jump-18-7']);
  });
});
