// ResourceCenterLayout.test.tsx 负责验证资源中心页面的布局与编排。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useResourceCenterPageModel: vi.fn(),
  ResourceCenterShell: vi.fn(({ dock, children }: any) => (
    <div data-testid="shell">
      <div data-testid="dock-slot">{dock}</div>
      <div data-testid="content-slot">{children}</div>
    </div>
  )),
  ResourceCenterDock: vi.fn((props: any) => (
    <aside data-testid="dock">
      {props.dockedPanel}|{props.tabDropZoneId}|{props.projectId ?? ''}
    </aside>
  )),
  ResourceScopeProvider: vi.fn(({ children }: any) => <div data-testid="scope-provider">{children}</div>),
  useParams: vi.fn(() => ({ projectId: 'project-1', kbId: 'kb-1' })),
  DndContext: vi.fn(({ children }: any) => <div data-testid="dnd-context">{children}</div>),
  Outlet: vi.fn(({ context }: any) => (
    <div data-testid="outlet">
      {context.activeTab}|{context.activePanel}|{context.disableTemplatePointerEvents ? 'locked' : 'open'}
    </div>
  )),
  TourProvider: vi.fn(({ children, tags }: any) => (
    <div data-testid="tour-provider">
      {tags.join(',')}
      {children}
    </div>
  )),
  TourOverlay: vi.fn(() => <div data-testid="tour-overlay">overlay</div>),
}));

vi.mock('../../model/useResourceCenterPageModel', () => ({
  default: mocks.useResourceCenterPageModel,
}));

vi.mock('../../../../widgets/resource-center-shell', () => ({
  default: mocks.ResourceCenterShell,
}));

vi.mock('../../../../widgets/resource-center-dock', () => ({
  ResourceCenterDock: mocks.ResourceCenterDock,
  default: mocks.ResourceCenterDock,
}));

vi.mock('react-router-dom', () => ({
  Outlet: mocks.Outlet,
  useParams: mocks.useParams,
}));

vi.mock('@dnd-kit/core', () => ({
  DndContext: mocks.DndContext,
}));

vi.mock('@leary/tour-guide', () => ({
  TourProvider: mocks.TourProvider,
  TourOverlay: mocks.TourOverlay,
}));

vi.mock('../../../../entities/resource-center', async () => {
  const actual = await vi.importActual('../../../../entities/resource-center');
  return {
    ...actual,
    ResourceScopeProvider: mocks.ResourceScopeProvider,
  };
});

import ResourceCenterLayout from '../ResourceCenterLayout';

describe('ResourceCenterLayout', () => {
  it('会将 page model 的 shell、dock 与 outlet 连接起来', () => {
    const dragFn = vi.fn();
    const pageModel = {
      dnd: {
        dragSensors: [{ id: 'sensor' }],
        collisionWithFallback: vi.fn(),
        handleTabDragStart: dragFn,
        handleTabDragEnd: dragFn,
        handleTabDragCancel: dragFn,
      },
      dockProps: {
        dockedPanel: 'ai',
        tabDropZoneId: 'sidebar-drop',
      },
      outletContext: {
        activeTab: 'all',
        activePanel: 'all',
        disableTemplatePointerEvents: true,
      },
      mobileActiveView: 'resource',
      onMobileViewChange: vi.fn(),
      toggleMobileActionSheet: vi.fn(),
      isMobileActionSheetOpen: true,
    };

    mocks.useResourceCenterPageModel.mockReturnValue(pageModel);

    const html = renderToStaticMarkup(<ResourceCenterLayout />);

    expect(mocks.useResourceCenterPageModel).toHaveBeenCalledWith({
      projectId: 'project-1',
      kbId: 'kb-1',
      sidebarDropZoneId: 'resource-center-sidebar-drop-zone',
      detailMergeDropZonePrefix: 'resource-center-merge-target:',
      detailGroupDragIdPrefix: 'resource-center-group-drag:',
    });
    expect(html).toContain('guide:resource-center:v1');
    expect(html).toContain('ai|sidebar-drop|');
    expect(html).toContain('all|all|locked');
    expect(html).toContain('overlay');
    expect(mocks.ResourceCenterShell.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        mobileActiveView: 'resource',
        onMobileViewChange: pageModel.onMobileViewChange,
        onMobileActionClick: pageModel.toggleMobileActionSheet,
        isMobileActionActive: true,
      })
    );
    expect(mocks.DndContext).toHaveBeenCalledTimes(1);
    expect(mocks.DndContext.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        sensors: pageModel.dnd.dragSensors,
        collisionDetection: pageModel.dnd.collisionWithFallback,
        onDragStart: dragFn,
        onDragEnd: dragFn,
        onDragCancel: dragFn,
      })
    );
  });
});
