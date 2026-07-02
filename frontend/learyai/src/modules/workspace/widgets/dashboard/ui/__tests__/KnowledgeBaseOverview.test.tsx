import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import KnowledgeBaseOverview from '../KnowledgeBaseOverview';

const mockState = vi.hoisted(() => ({
  persistedCount: '2',
  errorMessage: '内容加载失败：mock',
}));

vi.mock('@/shared/lib/formatters', () => ({
  formatVisitedAt: (value: string) => `visited:${value}`,
}));

vi.mock('@/shared/api/resolveApiError', () => ({
  resolveApiErrorMessage: () => mockState.errorMessage,
}));

vi.mock('@/shared/ui/icons/MaterialIcon', () => ({
  default: ({ name }: { name: string }) => <i>{name}</i>,
}));

vi.mock('@/shared/ui/SkeletonLoader', () => ({
  default: () => <div>kb-overview-skeleton</div>,
}));

vi.mock('@/shared/lib/safeLocalStorage', () => ({
  safeLocalStorageGet: () => mockState.persistedCount,
  safeLocalStorageSet: vi.fn(),
}));

class IntersectionObserverMock {
  observe() {}
  disconnect() {}
  unobserve() {}
}

vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);

vi.mock('@leary/tour-guide', () => ({
  TourStep: ({
    title,
    content,
    children,
  }: {
    title: string;
    content: string;
    children: React.ReactNode;
  }) => (
    <section data-testid="tour-step">
      <span>{title}</span>
      <span>{content}</span>
      {children}
    </section>
  ),
}));

describe('KnowledgeBaseOverview', () => {
  beforeEach(() => {
    mockState.persistedCount = '2';
    mockState.errorMessage = '内容加载失败：mock';
  });

  it('renders loading placeholders safely', () => {
    const markup = renderToStaticMarkup(
      <KnowledgeBaseOverview
        query={{
          data: undefined,
          isLoading: true,
          isPending: false,
          isFetching: false,
          isFetchingNextPage: false,
          hasNextPage: false,
          fetchNextPage: vi.fn(),
          isError: false,
          isSuccess: false,
          error: null,
        } as never}
        onVisit={vi.fn()}
      />
    );

    expect(markup).toContain('最近内容');
    expect(markup).toContain('kb-overview-skeleton');
  });

  it('renders recent content rows safely', () => {
    const markup = renderToStaticMarkup(
      <KnowledgeBaseOverview
        query={{
          data: {
            pages: [
              {
                items: [
                  {
                    resourceType: 'KB',
                    resourceId: 'kb-1',
                    kbId: 'kb-1',
                    projectId: 'project-1',
                    title: '产品知识库',
                    description: '用于沉淀产品文档',
                    available: true,
                    visitedAt: '2026-03-01T08:00:00.000Z',
                  },
                ],
                hasMore: false,
                nextCursor: null,
              },
            ],
            pageParams: [undefined],
          },
          isLoading: false,
          isPending: false,
          isFetching: false,
          isFetchingNextPage: false,
          hasNextPage: false,
          fetchNextPage: vi.fn(),
          isError: false,
          isSuccess: true,
          error: null,
        } as never}
        statusText="状态正常"
        onVisit={vi.fn()}
      />
    );

    expect(markup).toContain('状态正常');
    expect(markup).toContain('产品知识库');
    expect(markup).toContain('用于沉淀产品文档');
    expect(markup).toContain('知识库');
    expect(markup).toContain('visited:2026-03-01T08:00:00.000Z');
  });

  it('renders the error branch safely', () => {
    const markup = renderToStaticMarkup(
      <KnowledgeBaseOverview
        query={{
          data: undefined,
          isLoading: false,
          isPending: false,
          isFetching: false,
          isFetchingNextPage: false,
          hasNextPage: false,
          fetchNextPage: vi.fn(),
          isError: true,
          isSuccess: false,
          error: new Error('boom'),
        } as never}
        onVisit={vi.fn()}
      />
    );

    expect(markup).toContain('最近内容');
    expect(markup).toContain('内容加载失败：mock');
  });

  it('renders load-more hint when there are more pages', () => {
    const markup = renderToStaticMarkup(
      <KnowledgeBaseOverview
        query={{
          data: {
            pages: [
              {
                items: [
                  {
                    resourceType: 'KB',
                    resourceId: 'kb-1',
                    kbId: 'kb-1',
                    projectId: 'project-1',
                    title: '产品知识库',
                    description: '用于沉淀产品文档',
                    available: true,
                    visitedAt: '2026-03-01T08:00:00.000Z',
                  },
                ],
                hasMore: true,
                nextCursor: 'cursor-1',
              },
            ],
            pageParams: [undefined],
          },
          isLoading: false,
          isPending: false,
          isFetching: false,
          isFetchingNextPage: false,
          hasNextPage: true,
          fetchNextPage: vi.fn(),
          isError: false,
          isSuccess: true,
          error: null,
        } as never}
        onVisit={vi.fn()}
      />
    );

    expect(markup).toContain('滚动加载更多');
  });
});
