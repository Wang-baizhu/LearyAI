// @vitest-environment jsdom
// ResourceTopTabs.test.tsx 负责验证顶部标签在 chip/group 间的分支选择。
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  ResourceTabChip: vi.fn((props: any) => (
    <span data-testid="chip">
      {props.tab.key}|{props.mergeDropZoneId ?? 'none'}
    </span>
  )),
  ResourceTabGroup: vi.fn((props: any) => (
    <span data-testid="group">
      {props.tab.key}|{props.members.length}|{props.mergeDropZoneId}
    </span>
  )),
  MaterialIcon: vi.fn(({ name }: any) => <span data-icon={name} />),
}));

vi.mock('../ResourceTabChip', () => ({
  default: mocks.ResourceTabChip,
}));

vi.mock('../ResourceTabGroup', () => ({
  default: mocks.ResourceTabGroup,
}));

vi.mock('@/shared/ui/icons/MaterialIcon', () => ({
  default: mocks.MaterialIcon,
}));

import ResourceTopTabs from '../ResourceTopTabs';

describe('ResourceTopTabs', () => {
  beforeEach(() => {
    mocks.ResourceTabChip.mockClear();
    mocks.ResourceTabGroup.mockClear();
    mocks.MaterialIcon.mockClear();
  });

  it('会将可闭合且成员超过 1 个的标签渲染为聚合分组', () => {
    const html = renderToStaticMarkup(
      <ResourceTopTabs
        topTabItems={[
          { key: 'all', label: 'All', closable: false },
          { key: 'doc:1', label: 'Doc 1', closable: true },
          { key: 'doc:2', label: 'Doc 2', closable: true },
        ] as any}
        detailTabGroups={{
          'doc:1': [
            { key: 'doc:1', label: 'Doc 1' },
            { key: 'doc:1b', label: 'Doc 1B' },
          ],
          'doc:2': [{ key: 'doc:2', label: 'Doc 2' }],
        } as any}
        activeTopPanel="doc:1"
        activePanel="doc:1"
        activeListTab="all"
        detailMergeDropZonePrefix="merge:"
        onSelectTopTab={vi.fn()}
        onCloseDetailTab={vi.fn()}
        onCloseSingleDetailTab={vi.fn()}
      />
    );

    expect(html).toContain('all|none');
    expect(html).toContain('doc:1|2|merge:doc:1');
    expect(html).toContain('doc:2|merge:doc:2');
    expect(mocks.ResourceTabGroup).toHaveBeenCalledTimes(2);
    expect(mocks.ResourceTabChip).toHaveBeenCalledTimes(3);
  });

  it('会让顶部标签区域保持可横向滚动的布局约束', () => {
    const html = renderToStaticMarkup(
      <ResourceTopTabs
        topTabItems={[
          { key: 'all', label: 'All', closable: false },
          { key: 'doc:1', label: 'Doc 1', closable: true },
        ] as any}
        detailTabGroups={{
          'doc:1': [{ key: 'doc:1', label: 'Doc 1' }],
        } as any}
        activeTopPanel="all"
        activePanel="all"
        activeListTab="all"
        detailMergeDropZonePrefix="merge:"
        onSelectTopTab={vi.fn()}
        onCloseDetailTab={vi.fn()}
        onCloseSingleDetailTab={vi.fn()}
      />
    );

    expect(html).toContain('sm:hidden');
    expect(html).toContain('flex shrink-0 items-center gap-2');
    expect(html).toContain('flex w-max gap-3');
    expect(html).toContain('max-[420px]:hidden');
    expect(html).toContain('max-[420px]:block');
    expect(html).toContain('hidden min-w-0 flex-1 overflow-x-auto custom-scrollbar sm:block');
    expect(html).toContain('flex w-max gap-8');
  });

  it('会在移动端把固定分类合并为单一入口', () => {
    const html = renderToStaticMarkup(
      <ResourceTopTabs
        topTabItems={[
          { key: 'all', label: '全部资源', closable: false },
          { key: 'kbdoc', label: '参考文档', closable: false },
          { key: 'doc:1', label: 'Doc 1', closable: true },
        ] as any}
        detailTabGroups={{
          'doc:1': [{ key: 'doc:1', label: 'Doc 1' }],
        } as any}
        activeTopPanel="kbdoc"
        activePanel="kbdoc"
        activeListTab="kbdoc"
        detailMergeDropZonePrefix="merge:"
        onSelectTopTab={vi.fn()}
        onCloseDetailTab={vi.fn()}
        onCloseSingleDetailTab={vi.fn()}
      />
    );

    expect(html).toContain('参考文档');
    expect(html).toContain('data-icon="arrow_drop_down"');
    expect(html).toContain('max-w-[88px] truncate');
    expect(mocks.ResourceTabChip).toHaveBeenCalledWith(
      expect.objectContaining({
        tab: expect.objectContaining({ key: 'all' }),
      }),
      undefined
    );
    expect(mocks.ResourceTabChip).toHaveBeenCalledWith(
      expect.objectContaining({
        tab: expect.objectContaining({ key: 'kbdoc' }),
      }),
      undefined
    );
  });

  it('只会在点击箭头区域时展开分类菜单', () => {
    const onSelectTopTab = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);

    flushSync(() => {
      root.render(
        <ResourceTopTabs
          topTabItems={[
            { key: 'all', label: '全部资源', closable: false },
            { key: 'kbdoc', label: '参考文档', closable: false },
          ] as any}
          detailTabGroups={{} as any}
          activeTopPanel="kbdoc"
          activePanel="kbdoc"
          activeListTab="kbdoc"
          detailMergeDropZonePrefix="merge:"
          onSelectTopTab={onSelectTopTab}
          onCloseDetailTab={vi.fn()}
          onCloseSingleDetailTab={vi.fn()}
        />
      );
    });

    const mainButton = container.querySelector('[aria-label="切换到参考文档"]');
    const arrowButton = container.querySelector('[aria-label="展开分类选择"]');

    expect(mainButton).not.toBeNull();
    expect(arrowButton).not.toBeNull();
    expect(container.textContent).not.toContain('全部资源');

    flushSync(() => {
      mainButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onSelectTopTab).toHaveBeenCalledWith('kbdoc');
    expect(container.textContent).not.toContain('全部资源');

    flushSync(() => {
      arrowButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.textContent).toContain('全部资源');

    flushSync(() => {
      root.unmount();
    });
  });

  it('会在极窄屏详情菜单中关闭具体 tab', () => {
    const onSelectTopTab = vi.fn();
    const onCloseDetailTab = vi.fn();
    const onCloseSingleDetailTab = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);

    flushSync(() => {
      root.render(
        <ResourceTopTabs
          topTabItems={[
            { key: 'all', label: '全部资源', closable: false },
            { key: 'doc:root', label: '资源分组', closable: true },
            { key: 'doc:solo', label: '单独资源', closable: true },
          ] as any}
          detailTabGroups={{
            'doc:root': [
              { key: 'doc:root', label: '资源 A' },
              { key: 'doc:child', label: '资源 B' },
            ],
            'doc:solo': [{ key: 'doc:solo', label: '单独资源' }],
          } as any}
          activeTopPanel="doc:child"
          activePanel="doc:child"
          activeListTab="all"
          detailMergeDropZonePrefix="merge:"
          onSelectTopTab={onSelectTopTab}
          onCloseDetailTab={onCloseDetailTab}
          onCloseSingleDetailTab={onCloseSingleDetailTab}
        />
      );
    });

    const detailArrowButton = container.querySelector('[aria-label="展开详情标签选择"]');
    expect(detailArrowButton).not.toBeNull();

    flushSync(() => {
      detailArrowButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('资源 A');
    expect(container.textContent).toContain('资源 B');
    expect(container.textContent).toContain('单独资源');
    expect(container.innerHTML).toContain('overflow-hidden break-all text-[13px] leading-5');

    const closeGroupedMemberButton = container.querySelector('[aria-label="关闭详情资源 B"]');

    expect(closeGroupedMemberButton).not.toBeNull();

    flushSync(() => {
      closeGroupedMemberButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onCloseSingleDetailTab).toHaveBeenCalledWith('doc:child');

    flushSync(() => {
      detailArrowButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const closeSingleButton = container.querySelector('[aria-label="关闭详情单独资源"]');
    expect(closeSingleButton).not.toBeNull();
    flushSync(() => {
      closeSingleButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onCloseDetailTab).toHaveBeenCalledWith('doc:solo');

    flushSync(() => {
      root.unmount();
    });
  });
});
