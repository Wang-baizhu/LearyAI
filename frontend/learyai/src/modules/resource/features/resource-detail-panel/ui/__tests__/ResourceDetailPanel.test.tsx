// ResourceDetailPanel.test.tsx 负责验证资源详情面板的静态渲染路径。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useResourceCenterDetailState: vi.fn(),
  ResourceFlowCanvasDetail: vi.fn((props: any) => (
    <div data-testid="resource-flow-canvas-detail">
      {props.title ?? '默认白板'}
    </div>
  )),
  ResourceDetail: vi.fn((props: any) => (
    <div data-testid="resource-detail">
      {props.resource.docId}|{props.variant}|{String(props.jumpToPage ?? '')}|{props.previewPages.length}
    </div>
  )),
  ResourceVideoDetail: vi.fn((props: any) => (
    <div data-testid="resource-video-detail">
      {props.resource.docId}|{props.variant}|video
    </div>
  )),
}));

vi.mock('@/modules/resource/adapter/detail/model/hooks/useResourceCenterDetailState', () => ({
  useResourceCenterDetailState: mocks.useResourceCenterDetailState,
}));

vi.mock('@/modules/resource/adapter/flow-canvas', () => ({
  ResourceFlowCanvasDetail: mocks.ResourceFlowCanvasDetail,
}));

vi.mock('../../../../../kbdoc', () => ({
  ResourceDetail: mocks.ResourceDetail,
  ResourceVideoDetail: mocks.ResourceVideoDetail,
}));

import ResourceDetailPanel from '../ResourceDetailPanel';

describe('ResourceDetailPanel', () => {
  beforeEach(() => {
    mocks.useResourceCenterDetailState.mockReset();
    mocks.ResourceFlowCanvasDetail.mockClear();
    mocks.ResourceDetail.mockClear();
    mocks.ResourceVideoDetail.mockClear();

    mocks.useResourceCenterDetailState.mockReturnValue({
      isVideoDetail: false,
      detailQuery: {
        data: { docId: 'doc-1', fileType: 'pdf' },
        isLoading: false,
        isError: false,
        error: null,
      },
      resolvedJump: {
        jumpToPage: 7,
        jumpToken: 13,
        onJumpHandled: vi.fn(),
      },
      previewPagination: {
        previewPages: [{ pageNumber: 1, url: 'blob:1' }],
        isLoading: false,
        isLoadingMore: false,
        isLoadingPrevious: false,
        hasMore: false,
        hasPrevious: false,
        isJumpFailed: false,
        loadMore: vi.fn(),
        loadPrevious: vi.fn(),
        error: null,
      },
      textPagination: {
        textChunks: [],
        isLoading: false,
        isLoadingMore: false,
        isLoadingPrevious: false,
        hasMore: false,
        hasPrevious: false,
        isJumpFailed: false,
        loadMore: vi.fn(),
        loadPrevious: vi.fn(),
        error: null,
      },
    });
  });

  it('会在资源详情加载完成后渲染 ResourceDetail，并开启预览分页', () => {
    const html = renderToStaticMarkup(
      <ResourceDetailPanel docId="doc-1" kbId="kb-1" projectId="project-1" />
    );

    expect(html).toContain('doc-1|main|7|1');
    expect(mocks.useResourceCenterDetailState).toHaveBeenCalledWith({
      docId: 'doc-1',
      kbId: 'kb-1',
      projectId: 'project-1',
      enableJump: true,
      detailKind: 'kbdoc',
      jumpToPage: undefined,
      jumpToken: undefined,
      onJumpHandled: undefined,
      localJump: null,
    });
  });

  it('会在资源查询尚未完成时返回加载占位', () => {
    mocks.useResourceCenterDetailState.mockReturnValue({
      isVideoDetail: false,
      detailQuery: {
        data: null,
        isLoading: true,
        isError: false,
        error: null,
      },
      resolvedJump: {
        jumpToPage: 7,
        jumpToken: 13,
        onJumpHandled: vi.fn(),
      },
      previewPagination: {
        previewPages: [],
        isLoading: false,
        isLoadingMore: false,
        isLoadingPrevious: false,
        hasMore: false,
        hasPrevious: false,
        isJumpFailed: false,
        loadMore: vi.fn(),
        loadPrevious: vi.fn(),
        error: null,
      },
      textPagination: {
        textChunks: [],
        isLoading: false,
        isLoadingMore: false,
        isLoadingPrevious: false,
        hasMore: false,
        hasPrevious: false,
        isJumpFailed: false,
        loadMore: vi.fn(),
        loadPrevious: vi.fn(),
        error: null,
      },
    });

    const html = renderToStaticMarkup(
      <ResourceDetailPanel docId="doc-1" kbId="kb-1" projectId="project-1" />
    );

    expect(html).toContain('加载资源详情...');
  });

  it('会在视频详情模式下渲染独立的视频详情视图', () => {
    mocks.useResourceCenterDetailState.mockReturnValue({
      isVideoDetail: true,
      detailQuery: {
        data: { docId: 'doc-9', fileType: 'url', originUrl: 'https://www.bilibili.com/video/BV1rRM2z6EW6' },
        isLoading: false,
        isError: false,
        error: null,
      },
      resolvedJump: {
        jumpToPage: undefined,
        jumpToken: undefined,
        onJumpHandled: vi.fn(),
      },
      previewPagination: {
        previewPages: [],
        isLoading: false,
        isLoadingMore: false,
        isLoadingPrevious: false,
        hasMore: false,
        hasPrevious: false,
        isJumpFailed: false,
        loadMore: vi.fn(),
        loadPrevious: vi.fn(),
        error: null,
      },
      textPagination: {
        textChunks: [],
        isLoading: false,
        isLoadingMore: false,
        isLoadingPrevious: false,
        hasMore: false,
        hasPrevious: false,
        isJumpFailed: false,
        loadMore: vi.fn(),
        loadPrevious: vi.fn(),
        error: null,
      },
    });

    const html = renderToStaticMarkup(
      <ResourceDetailPanel
        docId="doc-9"
        kbId="kb-1"
        projectId="project-1"
        detailKind="video"
      />
    );

    expect(html).toContain('doc-9|main|video');
    expect(mocks.ResourceVideoDetail).toHaveBeenCalledTimes(1);
  });

  it('会在 whiteboard 模式下直接渲染全局视图白板', () => {
    const onOpenResourceDetailTab = vi.fn();
    const html = renderToStaticMarkup(
      <ResourceDetailPanel
        docId="resource-global-view"
        detailKind="whiteboard"
        whiteboardConfig={{ boardId: 'resource-global-view', title: '全局视图' }}
        onOpenResourceDetailTab={onOpenResourceDetailTab}
      />
    );

    expect(html).toContain('全局视图');
    expect(mocks.ResourceFlowCanvasDetail).toHaveBeenCalledWith(
      {
        kbId: undefined,
        projectId: undefined,
        onOpenDetailTab: expect.any(Function),
        title: '全局视图',
      },
      undefined
    );
    const whiteboardProps = mocks.ResourceFlowCanvasDetail.mock.calls[0][0];
    whiteboardProps.onOpenDetailTab({
      docId: 'doc-1',
      kind: 'kbdoc',
      label: '文档一',
    });
    expect(onOpenResourceDetailTab).toHaveBeenCalledWith('doc-1', '文档一');
    expect(mocks.useResourceCenterDetailState).not.toHaveBeenCalled();
  });
});
