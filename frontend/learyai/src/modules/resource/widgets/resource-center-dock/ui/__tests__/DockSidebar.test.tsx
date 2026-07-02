import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useDroppable: vi.fn(),
  MaterialIcon: vi.fn(({ name }: any) => <span data-icon={name} />),
  useResourceScope: vi.fn(() => ({ projectId: 'project-1', kbId: 'kb-1' })),
  ResourceCenterContent: vi.fn((props: any) => (
    <div data-testid="resource-center-content">
      {props.panel}|{props.variant}|{props.detailState?.docId ?? 'none'}|{props.listState ? 'list' : 'no-list'}|{props.aiState.resources.length}
    </div>
  )),
}));

vi.mock('@dnd-kit/core', () => ({
  useDroppable: mocks.useDroppable,
}));

vi.mock('@/shared/ui/icons/MaterialIcon', () => ({
  default: mocks.MaterialIcon,
}));

vi.mock('../../../resource-center-main', () => ({
  ResourceCenterContent: mocks.ResourceCenterContent,
}));

vi.mock('../../../../entities/resource-center', () => ({
  useResourceScope: mocks.useResourceScope,
}));

import DockSidebar from '../DockSidebar';

describe('DockSidebar', () => {
  beforeEach(() => {
    mocks.useDroppable.mockReset();
    mocks.ResourceCenterContent.mockClear();
    mocks.useDroppable.mockReturnValue({
      setNodeRef: vi.fn(),
      isOver: false,
    });
  });

  it('renders the detail-tab branch and switches the effective panel to all', () => {
    const html = renderToStaticMarkup(
      <DockSidebar
        dockedPanel="kbdoc"
        tabDropZoneId="sidebar-zone"
        resources={[{ docId: 'doc-1', name: '文档一' } as any]}
        referencedResources={[]}
        referencedDocRefs={[]}
        fallbackDocRef={null}
        listState={null}
        onToggleReference={vi.fn()}
        onToggleListReference={vi.fn()}
        referencedDocIds={[]}
        onClearReferences={vi.fn()}
        onPageChange={vi.fn()}
        onResourceDeleted={vi.fn()}
        sidebarDetailTab={{
          key: 'doc:doc-1',
          docId: 'doc-1',
          label: '文档一',
          kind: 'kbdoc',
        }}
        onClearSidebarDetail={vi.fn()}
        onOpenVideoDetailTab={vi.fn()}
        isDarkMode={false}
        toggleTheme={vi.fn()}
      />
    );

    expect(html).toContain('关闭详情并切换到 AI');
    expect(html).toContain('all|sidebar|doc-1|no-list|1');
    expect(mocks.ResourceCenterContent.mock.calls[0][0].detailState).toEqual(
      expect.objectContaining({
        docId: 'doc-1',
        detailKind: 'kbdoc',
        showCollapseToggle: true,
      })
    );
  });

  it('renders the docked list branch with list actions and ai state', () => {
    const html = renderToStaticMarkup(
      <DockSidebar
        dockedPanel="kbdoc"
        tabDropZoneId="sidebar-zone"
        resources={[
          { docId: 'doc-1', name: '文档一' } as any,
          { docId: 'doc-2', name: '文档二' } as any,
        ]}
        referencedResources={[{ docId: 'doc-2', name: '文档二' } as any]}
        referencedDocRefs={[{ id: 'doc-2', name: '文档二' }]}
        fallbackDocRef={{ id: 'doc-fallback', name: '兜底文档' }}
        listState={{
          kind: 'resource',
          gridItems: [{ docId: 'doc-1', name: '文档一', status: 'DONE' }],
          itemCount: 1,
          availableTemplateTags: [],
          availableTemplateSources: [],
          isGridLoading: false,
          isGridError: false,
          gridErrorMessage: '',
          totalPages: 1,
          isKnowledgeTab: true,
          aggregatedGroups: [],
          page: 1,
          showPagination: false,
          sections: undefined,
        } as any}
        onToggleReference={vi.fn()}
        onToggleListReference={vi.fn()}
        referencedDocIds={['doc-2']}
        onClearReferences={vi.fn()}
        onPageChange={vi.fn()}
        onResourceDeleted={vi.fn()}
        onClearSidebarDetail={vi.fn()}
        onOpenVideoDetailTab={vi.fn()}
        isDarkMode
        toggleTheme={vi.fn()}
      />
    );

    expect(html).toContain('kbdoc|sidebar|none|list|2');
    expect(mocks.ResourceCenterContent.mock.calls[0][0].listActions).toEqual(
      expect.objectContaining({
        referencedDocIds: ['doc-2'],
      })
    );
    expect(typeof mocks.ResourceCenterContent.mock.calls[0][0].listActions.onOpenResource).toBe('function');
  });
});
