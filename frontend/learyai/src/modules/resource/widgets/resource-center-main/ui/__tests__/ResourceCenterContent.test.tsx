// ResourceCenterContent.test.tsx 负责验证内容区的面板分发逻辑。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  ResourceCenterAiView: vi.fn((props: any) => (
    <div data-testid="ai-view">{props.variant}|{props.isCollapsed ? 'collapsed' : 'expanded'}</div>
  )),
  ResourceCenterListView: vi.fn((props: any) => (
    <div data-testid="list-view">{props.panel}|{props.variant}</div>
  )),
  ResourceCenterDetailRegion: vi.fn((props: any) => (
    <div data-testid="detail-region">
      {props.panel}|{props.variant}
      {props.listContent}
    </div>
  )),
}));

vi.mock('../ResourceCenterAiView', () => ({
  default: mocks.ResourceCenterAiView,
}));

vi.mock('../ResourceCenterListView', () => ({
  default: mocks.ResourceCenterListView,
}));

vi.mock('../ResourceCenterDetailRegion', () => ({
  default: mocks.ResourceCenterDetailRegion,
}));

import ResourceCenterContent from '../ResourceCenterContent';

describe('ResourceCenterContent', () => {
  it('在 AI 面板下直接渲染 AI 视图', () => {
    const html = renderToStaticMarkup(
      <ResourceCenterContent
        panel="ai"
        variant="main"
        isCollapsed
        onToggleCollapsed={vi.fn()}
        aiState={{
          resources: [],
          referencedResources: [],
          referencedDocRefs: [],
          onToggleReference: vi.fn(),
          onClearReferences: vi.fn(),
        }}
      />
    );

    expect(html).toContain('ai-view');
    expect(html).toContain('main|collapsed');
    expect(mocks.ResourceCenterListView).not.toHaveBeenCalled();
    expect(mocks.ResourceCenterDetailRegion).not.toHaveBeenCalled();
  });

  it('在资源面板下会把列表内容交给详情区域', () => {
    const html = renderToStaticMarkup(
      <ResourceCenterContent
        panel="all"
        variant="sidebar"
        listState={{ kind: 'grid', gridItems: [], isGridLoading: false, isGridError: false, totalPages: 0 } as any}
        listActions={{ onOpenResource: vi.fn(), onOpenTemplate: vi.fn(), referencedDocIds: [], onPageChange: vi.fn() } as any}
        detailState={{ docId: 'doc-1' } as any}
        detailFloatingAction={<span>floating</span>}
      />
    );

    expect(html).toContain('detail-region');
    expect(html).toContain('all|sidebar');
    expect(html).toContain('list-view');
    expect(mocks.ResourceCenterListView).toHaveBeenCalledTimes(1);
    expect(mocks.ResourceCenterDetailRegion).toHaveBeenCalledTimes(1);
  });
});
