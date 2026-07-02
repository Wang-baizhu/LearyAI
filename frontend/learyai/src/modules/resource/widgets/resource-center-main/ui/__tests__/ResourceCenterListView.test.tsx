import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  ResourceGrid: vi.fn((props: any) => (
    <div data-testid="resource-grid">
      resource:{props.items.length}|refs:{props.referencedDocIds?.length ?? 0}
    </div>
  )),
  MaterialIcon: vi.fn(({ name }: any) => <span data-icon={name} />),
  SkeletonLoader: vi.fn(() => <div data-testid="skeleton-loader">skeleton</div>),
  useResourceScope: vi.fn(() => ({ projectId: 'project-1', kbId: 'kb-1' })),
}));

vi.mock('../../../../../kbdoc', () => ({
  ResourceGrid: mocks.ResourceGrid,
}));

vi.mock('@/shared/ui/icons/MaterialIcon', () => ({
  default: mocks.MaterialIcon,
}));

vi.mock('@/shared/ui/SkeletonLoader', () => ({
  default: mocks.SkeletonLoader,
}));

vi.mock('../../../../entities/resource-center', async () => {
  const actual = await vi.importActual('../../../../entities/resource-center');
  return {
    ...actual,
    useResourceScope: mocks.useResourceScope,
  };
});

import ResourceCenterListView from '../ResourceCenterListView';

describe('ResourceCenterListView', () => {
  beforeEach(() => {
    mocks.ResourceGrid.mockClear();
  });

  it('渲染侧栏 mixed 视图时只输出文档分组', () => {
    const html = renderToStaticMarkup(
      <ResourceCenterListView
        panel="all"
        variant="sidebar"
        onToggleCollapsed={vi.fn()}
        listState={{
          kind: 'mixed',
          gridItems: [],
          itemCount: 1,
          availableTemplateTags: [],
          availableTemplateSources: [],
          isGridLoading: false,
          isGridError: false,
          gridErrorMessage: '',
          totalPages: 1,
          isKnowledgeTab: false,
          aggregatedGroups: [
            { key: 'docs', label: '文档', total: 1 },
          ],
          page: 1,
          showPagination: false,
          sections: {
            docs: {
              items: [{ docId: 'doc-1', name: '文档一', status: 'DONE' }],
              total: 1,
              isLoading: false,
              isError: false,
              errorMessage: '',
            },
          },
        } as any}
        listActions={{
          onOpenResource: vi.fn(),
          onToggleReference: vi.fn(),
          referencedDocIds: ['doc-1'],
          onPageChange: vi.fn(),
        }}
      />
    );

    expect(html).toContain('全部资源');
    expect(html).toContain('收起侧栏');
    expect(html).toContain('文档');
    expect(html).toContain('resource-grid');
    expect(mocks.ResourceGrid).toHaveBeenCalledTimes(1);
  });

  it('渲染文档列表分页与全局视图按钮', () => {
    const html = renderToStaticMarkup(
      <ResourceCenterListView
        panel="all"
        variant="main"
        listState={{
          kind: 'resource',
          gridItems: [{ docId: 'doc-1', name: '文档一', status: 'DONE' }],
          itemCount: 33,
          availableTemplateTags: [],
          availableTemplateSources: [],
          isGridLoading: false,
          isGridError: false,
          gridErrorMessage: '',
          totalPages: 5,
          isKnowledgeTab: true,
          aggregatedGroups: [],
          page: 2,
          showPagination: true,
          sections: undefined,
        } as any}
        listActions={{
          onOpenResource: vi.fn(),
          onOpenGlobalView: vi.fn(),
          referencedDocIds: [],
          onPageChange: vi.fn(),
        }}
      />
    );

    expect(html).toContain('全部资源');
    expect(html).toContain('33 条');
    expect(html).toContain('查看全局视图');
    expect(html).toContain('第 2 / 5 页');
    expect(mocks.ResourceGrid).toHaveBeenCalledTimes(1);
  });
});
