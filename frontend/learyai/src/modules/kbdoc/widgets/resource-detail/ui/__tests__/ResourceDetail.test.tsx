// @vitest-environment jsdom
// ResourceDetail.test.tsx 负责验证资源详情页的静态渲染与交互分发。
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { parseDocumentationTree } from '../../../../entities/resource/lib/documentationTree';

const mocks = vi.hoisted(() => ({
  EditableText: vi.fn(({ children }: any) => <>{children}</>),
  EditableTextDialog: vi.fn((props: any) => props ? null : null),
  RichTextMarkdown: vi.fn((props: any) => <div data-testid="rich-text-markdown">{props.text}</div>),
  CitationMarkdown: vi.fn((props: any) => <div data-testid="citation-markdown">{props.text}</div>),
  DocumentationPanel: vi.fn((props: any) => <div data-testid="documentation-panel">{JSON.stringify(props.tree)}</div>),
  MaterialIcon: vi.fn(({ name }: any) => <span data-icon={name} />),
  useAppDispatch: vi.fn(),
  useAppSelector: vi.fn(),
  enqueueToast: vi.fn((payload: any) => ({ type: 'ui/enqueueToast', payload })),
  requestVideoJump: vi.fn((payload: any) => ({ type: 'resource/requestVideoJump', payload })),
  requestCitationJump: vi.fn((payload: any) => ({ type: 'resource/requestCitationJump', payload })),
  renameReferenceResource: vi.fn((payload: any) => ({ type: 'resource/renameReferenceResource', payload })),
  upsertDocNames: vi.fn((payload: any) => ({ type: 'resource/upsertDocNames', payload })),
  resolveApiErrorMessage: vi.fn(() => '更新失败，请稍后重试'),
  useUpdateResourceDetail: vi.fn(),
}));

vi.mock('@leary/text-editable', () => ({
  EditableText: mocks.EditableText,
  EditableTextDialog: mocks.EditableTextDialog,
}));

vi.mock('../RichTextMarkdown', () => ({
  default: mocks.RichTextMarkdown,
}));

vi.mock('@/shared/ui/CitationMarkdown', () => ({
  default: mocks.CitationMarkdown,
}));

vi.mock('../DocumentationPanel', () => ({
  default: mocks.DocumentationPanel,
}));

vi.mock('@/shared/ui/icons/MaterialIcon', () => ({
  default: mocks.MaterialIcon,
}));

vi.mock('@/app/store/hooks', () => ({
  useAppDispatch: mocks.useAppDispatch,
  useAppSelector: mocks.useAppSelector,
}));

vi.mock('@/app/store/ui/toastSlice', () => ({
  enqueueToast: mocks.enqueueToast,
}));

vi.mock('@/modules/resource', () => ({
  requestVideoJump: mocks.requestVideoJump,
  requestCitationJump: mocks.requestCitationJump,
  renameReferenceResource: mocks.renameReferenceResource,
  upsertDocNames: mocks.upsertDocNames,
}));

vi.mock('@/shared/api/resolveApiError', () => ({
  resolveApiErrorMessage: mocks.resolveApiErrorMessage,
}));

vi.mock('../../../../entities/resource', async () => {
  const actual = await vi.importActual<{ parseDocumentationTree: typeof parseDocumentationTree }>(
    '../../../../entities/resource/lib/documentationTree'
  );
  return {
    useUpdateResourceDetail: mocks.useUpdateResourceDetail,
    parseDocumentationTree: actual.parseDocumentationTree,
  };
});

import ResourceDetail from '../ResourceDetail';

describe('ResourceDetail', () => {
  beforeEach(() => {
    mocks.EditableText.mockClear();
    mocks.EditableTextDialog.mockClear();
    mocks.RichTextMarkdown.mockClear();
    mocks.CitationMarkdown.mockClear();
    mocks.DocumentationPanel.mockClear();
    mocks.MaterialIcon.mockClear();
    mocks.useAppDispatch.mockReset();
    mocks.useAppSelector.mockReset();
    mocks.enqueueToast.mockClear();
    mocks.requestVideoJump.mockClear();
    mocks.requestCitationJump.mockClear();
    mocks.renameReferenceResource.mockClear();
    mocks.upsertDocNames.mockClear();
    mocks.resolveApiErrorMessage.mockClear();
    mocks.useUpdateResourceDetail.mockReset();
    mocks.useAppDispatch.mockReturnValue(vi.fn());
    mocks.useUpdateResourceDetail.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    });
    mocks.useAppSelector.mockImplementation((selector: (state: any) => unknown) =>
      selector({
        resourceCenter: {
          docNameMap: {
            'doc-9': '操作手册',
            'doc-10': '章节目录',
          },
        },
      })
    );
  });

  it('有跳页参数时会先把外层详情滚动容器滚到 viewer 顶部', async () => {
    const originalScrollTo = HTMLDivElement.prototype.scrollTo;
    Object.defineProperty(HTMLDivElement.prototype, 'scrollTo', {
      configurable: true,
      value: function scrollTo(this: HTMLDivElement, options?: ScrollToOptions | number) {
        if (typeof options === 'number') {
          this.scrollTop = options;
          return;
        }
        this.scrollTop = options?.top ?? 0;
      },
    });

    const originalRequestAnimationFrame = window.requestAnimationFrame;
    const originalCancelAnimationFrame = window.cancelAnimationFrame;
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    }) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = vi.fn();

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      flushSync(() => {
        root.render(
          <ResourceDetail
            resource={{
              docId: 'doc-1',
              name: '项目手册',
              createdAt: '2026-03-29',
              fileType: 'pdf',
            } as any}
            previewPages={[
              { pageNumber: 8, url: 'https://example.com/page-8.png' },
            ]}
            jumpToPage={8}
            jumpToken={99}
          />
        );
      });

      const scrollContainer = container.querySelector('.custom-scrollbar') as HTMLDivElement | null;
      expect(scrollContainer).toBeTruthy();
      if (!scrollContainer) {
        throw new Error('应渲染外层详情滚动容器');
      }

      const viewerSection = container.querySelector('[data-testid="resource-detail-viewer-section"]') as HTMLDivElement | null;
      expect(viewerSection).toBeTruthy();
      if (!viewerSection) {
        throw new Error('应定位到 viewer 外层容器');
      }

      Object.defineProperty(scrollContainer, 'scrollTop', {
        configurable: true,
        writable: true,
        value: 120,
      });
      scrollContainer.getBoundingClientRect = () =>
        ({ top: 100, left: 0, right: 0, bottom: 800, width: 0, height: 700, x: 0, y: 100, toJSON: () => ({}) }) as DOMRect;
      viewerSection.getBoundingClientRect = () =>
        ({ top: 460, left: 0, right: 0, bottom: 1060, width: 0, height: 600, x: 0, y: 460, toJSON: () => ({}) }) as DOMRect;

      flushSync(() => {
        root.render(
          <ResourceDetail
            resource={{
              docId: 'doc-1',
              name: '项目手册',
              createdAt: '2026-03-29',
              fileType: 'pdf',
            } as any}
            previewPages={[
              { pageNumber: 8, url: 'https://example.com/page-8.png' },
            ]}
            jumpToPage={8}
            jumpToken={100}
          />
        );
      });

      expect(scrollContainer.scrollTop).toBe(480);
    } finally {
      flushSync(() => {
        root.unmount();
      });
      container.remove();
      Object.defineProperty(HTMLDivElement.prototype, 'scrollTo', {
        configurable: true,
        value: originalScrollTo,
      });
      window.requestAnimationFrame = originalRequestAnimationFrame;
      window.cancelAnimationFrame = originalCancelAnimationFrame;
    }
  });

  it('renders the image preview path for previewable documents', () => {
    const html = renderToStaticMarkup(
      <ResourceDetail
        resource={{
          docId: 'doc-1',
          name: '项目手册',
          createdAt: '2026-03-29',
          fileType: 'pdf',
        } as any}
        previewPages={[
          { pageNumber: 2, url: 'https://example.com/page-2.png' },
        ]}
        jumpToPage={2}
      />
    );

    expect(html).toContain('项目手册');
    expect(html).toContain('Document Viewer');
    expect(html).toContain('page-2');
    expect(html).toContain('PDF');
    expect(html).toContain('2026-03-29');
  });

  it('renders the text preview path for markdown, text, url and audio resources', () => {
    const html = renderToStaticMarkup(
      <ResourceDetail
        resource={{
          docId: 'doc-2',
          name: '会议纪要',
          createdAt: '2026-03-29',
          fileType: 'url',
        } as any}
        textPreviewChunks={[
          { chunkSec: 12, text: 'hello **world**' },
        ]}
      />
    );

    expect(html).toContain('会议纪要');
    expect(html).toContain('Document Viewer');
    expect(html).toContain('hello **world**');
    expect(html).toContain('URL');
    expect(mocks.RichTextMarkdown).toHaveBeenCalledTimes(1);
    expect(mocks.RichTextMarkdown).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'hello **world**',
        activeSeconds: null,
        onTimestampClick: undefined,
        onCitationClick: expect.any(Function),
      }),
      undefined
    );
  });

  it('renders the metadata sections when the resource provides overview and documentation', () => {
    const html = renderToStaticMarkup(
      <ResourceDetail
        resource={{
          docId: 'doc-9',
          name: '操作手册',
          createdAt: '2026-03-29',
          fileType: 'txt',
          metadata: {
            description: '这是一份帮助用户快速理解文档内容范围的概要。',
            documentation: {
              version: 1,
              nodes: [
                {
                  id: 'chapter-1',
                  title: '第一章 安装',
                  summary: '介绍安装流程',
                  page_start: 1,
                  page_end: 3,
                  children: [],
                },
              ],
            },
          },
        } as any}
        textPreviewChunks={[
          { chunkSec: 1, text: '正文片段' },
        ]}
      />
    );

    expect(html).toContain('文档概要');
    expect(html).toContain('这是一份帮助用户快速理解文档内容范围的概要。');
    expect(mocks.CitationMarkdown).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        text: '这是一份帮助用户快速理解文档内容范围的概要。',
        pageMarkerDocId: 'doc-9',
      }),
      undefined
    );
    expect(mocks.DocumentationPanel).toHaveBeenCalledWith(
      expect.objectContaining({
        docId: 'doc-9',
        className: 'h-full',
        onCitationClick: expect.any(Function),
        onRequestTextEdit: expect.any(Function),
        tree: {
          version: 1,
          nodes: [
            {
              id: 'chapter-1',
              title: '第一章 安装',
              summary: '介绍安装流程',
              page_start: 1,
              page_end: 3,
              children: [],
            },
          ],
        },
      }),
      undefined
    );
  });

  it('passes documentation tree click handler down and handles current-doc jumps locally', () => {
    const dispatch = vi.fn();
    const onRequestJump = vi.fn();
    mocks.useAppDispatch.mockReturnValue(dispatch);

    renderToStaticMarkup(
      <ResourceDetail
        resource={{
          docId: 'doc-10',
          name: '章节目录',
          createdAt: '2026-03-29',
          fileType: 'pdf',
          metadata: {
            documentation: {
              version: 1,
              nodes: [
                {
                  id: 'chapter-1',
                  title: '第一章 概述',
                  summary: '介绍总览',
                  page_start: 1,
                  page_end: 3,
                  children: [],
                },
              ],
            },
          },
        } as any}
        previewPages={[
          { pageNumber: 1, url: 'https://example.com/page-1.png' },
        ]}
        onRequestJump={onRequestJump}
      />
    );

    expect(mocks.DocumentationPanel).toHaveBeenCalledWith(
      expect.objectContaining({
        tree: {
          version: 1,
          nodes: [
            {
              id: 'chapter-1',
              title: '第一章 概述',
              summary: '介绍总览',
              page_start: 1,
              page_end: 3,
              children: [],
            },
          ],
        },
        docId: 'doc-10',
        className: 'h-full',
        onCitationClick: expect.any(Function),
        onRequestTextEdit: expect.any(Function),
      }),
      undefined
    );

    const onCitationClick = mocks.DocumentationPanel.mock.calls[0][0].onCitationClick;
    onCitationClick({ label: '1-3', type: 'doc-10', page: '1-3', pageValue: '1-3' });

    expect(onRequestJump).toHaveBeenCalledTimes(1);
    expect(onRequestJump.mock.calls[0][0]).toBe(1);
    expect(mocks.requestCitationJump).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('passes object documentation metadata directly to DocumentationPanel', () => {
    renderToStaticMarkup(
      <ResourceDetail
        resource={{
          docId: 'doc-14',
          name: '对象目录',
          createdAt: '2026-03-29',
          fileType: 'pdf',
          metadata: {
            documentation: {
              version: 1,
              nodes: [
                {
                  id: 'chapter-1',
                  title: '第一章 对象结构',
                  summary: '直接返回对象',
                  page_start: 2,
                  page_end: 4,
                  children: [],
                },
              ],
            },
          },
        } as any}
        previewPages={[
          { pageNumber: 2, url: 'https://example.com/page-2.png' },
        ]}
      />
    );

    expect(mocks.DocumentationPanel).toHaveBeenCalledWith(
      expect.objectContaining({
        tree: {
          version: 1,
          nodes: [
            {
              id: 'chapter-1',
              title: '第一章 对象结构',
              summary: '直接返回对象',
              page_start: 2,
              page_end: 4,
              children: [],
            },
          ],
        },
        docId: 'doc-14',
        className: 'h-full',
      }),
      undefined
    );
  });

  it('renders a desktop sidebar mount and a mobile drawer toggle when documentation exists', () => {
    const html = renderToStaticMarkup(
      <ResourceDetail
        resource={{
          docId: 'doc-15',
          name: '目录布局',
          createdAt: '2026-03-29',
          fileType: 'pdf',
          metadata: {
            documentation: {
              version: 1,
              nodes: [
                {
                  id: 'chapter-1',
                  title: '第一章',
                  summary: '摘要',
                  page_start: 1,
                  page_end: 2,
                  children: [],
                },
              ],
            },
          },
        } as any}
        previewPages={[
          { pageNumber: 1, url: 'https://example.com/page-1.png' },
        ]}
      />
    );

    expect(html).toContain('data-testid="documentation-sidebar"');
    expect(html).toContain('展开目录抽屉');
    expect(html).toContain('left_panel_open');
    expect(html).toContain('收起左侧目录');
    expect(html).toContain('keyboard_double_arrow_left');
  });

  it('renders the open-video action for url resources with originUrl', () => {
    const handleOpenVideoDetailTab = vi.fn();
    const html = renderToStaticMarkup(
      <ResourceDetail
        resource={{
          docId: 'doc-4',
          name: '课程视频',
          createdAt: '2026-03-29',
          fileType: 'url',
          originUrl: 'https://www.bilibili.com/video/BV1rRM2z6EW6?p=1',
        } as any}
        textPreviewChunks={[
          { chunkSec: 1, text: '定位到[00:00:07-00:00:10]' },
        ]}
        onOpenVideoDetailTab={handleOpenVideoDetailTab}
      />
    );

    expect(html).toContain('查看视频');
    expect(html).not.toContain('视频入口');
    expect(mocks.RichTextMarkdown).toHaveBeenLastCalledWith(
      expect.objectContaining({
        text: '定位到[00:00:07-00:00:10]',
        activeSeconds: null,
        onTimestampClick: expect.any(Function),
        onCitationClick: expect.any(Function),
      }),
      undefined
    );
  });

  it('dispatches video jump request without opening a video tab when clicking a timestamp in url detail', () => {
    const dispatch = vi.fn();
    const handleOpenVideoDetailTab = vi.fn();
    mocks.useAppDispatch.mockReturnValue(dispatch);

    renderToStaticMarkup(
      <ResourceDetail
        resource={{
          docId: 'doc-4',
          name: '课程视频',
          createdAt: '2026-03-29',
          fileType: 'url',
          originUrl: 'https://www.bilibili.com/video/BV1rRM2z6EW6?p=1',
        } as any}
        textPreviewChunks={[
          { chunkSec: 1, text: '定位到[00:00:07-00:00:10]' },
        ]}
        onOpenVideoDetailTab={handleOpenVideoDetailTab}
      />
    );

    const onTimestampClick = mocks.RichTextMarkdown.mock.calls[0][0].onTimestampClick;
    onTimestampClick(7);

    expect(handleOpenVideoDetailTab).not.toHaveBeenCalled();
    expect(mocks.requestVideoJump).toHaveBeenCalledWith({
      docId: 'doc-4',
      startSeconds: 7,
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: 'resource/requestVideoJump',
      payload: {
        docId: 'doc-4',
        startSeconds: 7,
      },
    });
  });

  it('does not expose video actions when the detail cannot open a video tab', () => {
    const dispatch = vi.fn();
    mocks.useAppDispatch.mockReturnValue(dispatch);

    const html = renderToStaticMarkup(
      <ResourceDetail
        resource={{
          docId: 'doc-5',
          name: '全屏视频详情',
          createdAt: '2026-03-29',
          fileType: 'url',
          originUrl: 'https://www.bilibili.com/video/BV1rRM2z6EW6?p=1',
        } as any}
        textPreviewChunks={[
          { chunkSec: 1, text: '定位到[00:00:07-00:00:10]' },
        ]}
      />
    );

    expect(html).not.toContain('查看视频');
    expect(mocks.RichTextMarkdown).toHaveBeenLastCalledWith(
      expect.objectContaining({
        text: '定位到[00:00:07-00:00:10]',
        onTimestampClick: undefined,
        onCitationClick: expect.any(Function),
      }),
      undefined
    );
    expect(mocks.requestVideoJump).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('normalizes text preview page markers and dispatches citation jump for text chunks', () => {
    const dispatch = vi.fn();
    mocks.useAppDispatch.mockReturnValue(dispatch);

    renderToStaticMarkup(
      <ResourceDetail
        resource={{
          docId: 'doc-11',
          name: '正文索引',
          createdAt: '2026-03-29',
          fileType: 'txt',
        } as any}
        textPreviewChunks={[
          { chunkSec: 3, text: '正文引用 (page: 8-9)' },
        ]}
      />
    );

    expect(mocks.RichTextMarkdown).toHaveBeenCalledWith(
      expect.objectContaining({
        text: '正文引用 (page: 8-9)',
        pageMarkerDocId: 'doc-11',
        onCitationClick: expect.any(Function),
      }),
      undefined
    );

    const onCitationClick = mocks.RichTextMarkdown.mock.calls[0][0].onCitationClick;
    onCitationClick({ label: '8-9', type: 'doc-11', page: '8-9', pageValue: '8-9' });

    expect(mocks.requestCitationJump).toHaveBeenCalledWith({
      source: 'doc-11',
      pageText: '8-9',
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: 'resource/requestCitationJump',
      payload: {
        source: 'doc-11',
        pageText: '8-9',
      },
    });
  });

  it('dispatches text citation jump with the citation target docId instead of current detail docId', () => {
    const dispatch = vi.fn();
    mocks.useAppDispatch.mockReturnValue(dispatch);

    renderToStaticMarkup(
      <ResourceDetail
        resource={{
          docId: 'current-doc',
          name: '正文引用',
          createdAt: '2026-03-29',
          fileType: 'txt',
        } as any}
        textPreviewChunks={[
          { chunkSec: 3, text: '跨文档引用 ([target-doc][12])' },
        ]}
      />
    );

    const onCitationClick = mocks.RichTextMarkdown.mock.calls[0][0].onCitationClick;
    onCitationClick({ label: 'target-doc', type: 'target-doc', page: '12', pageValue: '12' });

    expect(mocks.requestCitationJump).toHaveBeenCalledWith({
      source: 'target-doc',
      pageText: '12',
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: 'resource/requestCitationJump',
      payload: {
        source: 'target-doc',
        pageText: '12',
      },
    });
  });

  it('renders the unsupported state for non-previewable files', () => {
    const html = renderToStaticMarkup(
      <ResourceDetail
        resource={{
          docId: 'doc-3',
          name: '数据表',
          createdAt: '2026-03-29',
          fileType: 'xlsx',
        } as any}
      />
    );

    expect(html).toContain('当前格式暂不支持预览');
    expect(html).toContain('数据表');
  });

  it('图片跳页越界时不会再渲染内联失败文案或持续定位文案', () => {
    const html = renderToStaticMarkup(
      <ResourceDetail
        resource={{
          docId: 'doc-12',
          name: '图片预览失败',
          createdAt: '2026-03-29',
          fileType: 'pdf',
        } as any}
        previewPages={[]}
        jumpToPage={99}
        isPreviewJumpFailed
      />
    );

    expect(html).not.toContain('查询失败');
    expect(html).not.toContain('正在定位到第 99 页，请稍候');
  });

  it('文本跳页越界时不会再渲染内联失败文案或持续定位文案', () => {
    const html = renderToStaticMarkup(
      <ResourceDetail
        resource={{
          docId: 'doc-13',
          name: '文本预览失败',
          createdAt: '2026-03-29',
          fileType: 'txt',
        } as any}
        textPreviewChunks={[]}
        jumpToPage={99}
        isTextJumpFailed
      />
    );

    expect(html).not.toContain('查询失败');
    expect(html).not.toContain('正在定位到第 99 段，请稍候');
  });

  it('编辑目录节点时会保留已有 description 一起提交', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({
      docId: 'doc-11',
      name: '产品手册',
    });
    mocks.useUpdateResourceDetail.mockReturnValue({
      isPending: false,
      mutateAsync,
    });

    const container = document.createElement('div');
    const root = createRoot(container);

    flushSync(() => {
      root.render(
        <ResourceDetail
          projectId="project-1"
          resource={{
            docId: 'doc-11',
            name: '产品手册',
            createdAt: '2026-03-29',
            fileType: 'pdf',
            metadata: {
              description: '原有概要内容',
              documentation: {
                version: 1,
                nodes: [
                  {
                    id: 'chapter-1',
                    title: '第一章 概述',
                    summary: '原摘要',
                    page_start: 1,
                    page_end: 2,
                    children: [],
                  },
                ],
              },
            },
          } as any}
          previewPages={[
            { pageNumber: 1, url: 'https://example.com/page-1.png' },
          ]}
        />
      );
    });

    const lastPanelCall = mocks.DocumentationPanel.mock.lastCall;
    expect(lastPanelCall).toBeDefined();
    if (!lastPanelCall) {
      throw new Error('DocumentationPanel 应收到目录编辑回调');
    }
    const [panelProps] = lastPanelCall;
    expect(panelProps.onRequestTextEdit).toBeInstanceOf(Function);

    flushSync(() => {
      panelProps.onRequestTextEdit({
        title: '目录摘要',
        value: '原摘要',
        anchor: { kind: 'directory', nodeId: 'chapter-1', field: 'summary' },
        multiline: true,
      });
    });

    const lastDialogCall = mocks.EditableTextDialog.mock.lastCall;
    expect(lastDialogCall).toBeDefined();
    if (!lastDialogCall) {
      throw new Error('EditableTextDialog 应在目录编辑时打开');
    }
    const [dialogProps] = lastDialogCall;
    expect(dialogProps.session).toEqual({
      title: '目录摘要',
      value: '原摘要',
      anchor: { kind: 'directory', nodeId: 'chapter-1', field: 'summary' },
      multiline: true,
    });

    await dialogProps.onSave('更新后的目录摘要', dialogProps.session);

    expect(mutateAsync).toHaveBeenCalledWith({
      docId: 'doc-11',
      payload: {
        name: '产品手册',
        description: '原有概要内容',
        documentation: {
          version: 1,
          nodes: [
            {
              id: 'chapter-1',
              title: '第一章 概述',
              summary: '更新后的目录摘要',
              page_start: 1,
              page_end: 2,
              children: [],
            },
          ],
        },
      },
    });

    flushSync(() => {
      root.unmount();
    });
  });
});
