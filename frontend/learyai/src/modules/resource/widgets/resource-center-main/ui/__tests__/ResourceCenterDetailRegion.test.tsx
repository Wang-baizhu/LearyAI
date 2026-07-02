// ResourceCenterDetailRegion.test.tsx 负责验证详情区域与列表回退的编排。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  ResourceDetailPanel: vi.fn((props: any) => (
    <div data-testid="resource-detail-panel">
      {props.docId}|{props.variant}
    </div>
  )),
}));

vi.mock('../../../../features/resource-detail-panel', () => ({
  default: mocks.ResourceDetailPanel,
}));

import ResourceCenterDetailRegion from '../ResourceCenterDetailRegion';

describe('ResourceCenterDetailRegion', () => {
  it('会在多详情状态下仅高亮当前面板，并渲染浮动操作入口', () => {
    const html = renderToStaticMarkup(
      <ResourceCenterDetailRegion
        panel="doc:2"
        variant="main"
        detailStates={[
          { key: 'doc:1', state: { docId: 'doc-1' } as any },
          { key: 'doc:2', state: { docId: 'doc-2' } as any },
        ]}
        listContent={<div>list</div>}
        floatingAction={<span>floating</span>}
      />
    );

    expect(html).toContain('doc-1|main');
    expect(html).toContain('doc-2|main');
    expect(html).toContain('floating');
    expect(html).toContain('hidden');
    expect(mocks.ResourceDetailPanel).toHaveBeenCalledTimes(2);
  });

  it('在非详情面板且存在 detailState 时会保留隐藏详情并渲染列表内容', () => {
    const html = renderToStaticMarkup(
      <ResourceCenterDetailRegion
        panel="all"
        variant="main"
        detailState={{ docId: 'doc-3' } as any}
        listContent={<div>list-content</div>}
      />
    );

    expect(html).toContain('hidden');
    expect(html).toContain('list-content');
    expect(mocks.ResourceDetailPanel).toHaveBeenCalledTimes(1);
    expect(mocks.ResourceDetailPanel.mock.calls[0][0]).toEqual(
      expect.objectContaining({ docId: 'doc-3', variant: 'main' })
    );
  });
});
