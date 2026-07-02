// ResourceCenterDock.test.tsx 负责验证停靠栏错误边界与子组件装配。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  DockSidebar: vi.fn((props: any) => <aside data-testid="dock-sidebar">{props.dockedPanel}</aside>),
}));

vi.mock('../DockSidebar', () => ({
  default: mocks.DockSidebar,
}));

import ResourceCenterDock from '../ResourceCenterDock';

describe('ResourceCenterDock', () => {
  it('会在错误边界内渲染 DockSidebar', () => {
    const html = renderToStaticMarkup(
      <ResourceCenterDock
        dockedPanel="ai"
        tabDropZoneId="tab-zone"
        resources={[] as any}
        referencedResources={[] as any}
        referencedDocRefs={[]}
        fallbackDocRef={null}
        listState={null}
        onToggleReference={vi.fn()}
        onToggleListReference={vi.fn()}
        referencedDocIds={[]}
        onClearReferences={vi.fn()}
        onPageChange={vi.fn()}
        onResourceDeleted={vi.fn()}
        onClearSidebarDetail={vi.fn()}
        isDarkMode={false}
        toggleTheme={vi.fn()}
      />
    );

    expect(html).toContain('ai');
    expect(mocks.DockSidebar).toHaveBeenCalledTimes(1);
  });
});
