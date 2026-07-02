// @vitest-environment jsdom
// DocumentationPanel.test.tsx 负责验证文档目录树的展开收起与页码跳转行为。
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import DocumentationPanel from '../DocumentationPanel';

const documentationTree = {
  version: 1,
  nodes: [
    {
      id: 'chapter-1',
      title: '第一章 项目背景',
      summary: '介绍项目目标与范围',
      page_start: 1,
      page_end: 3,
      children: [
        {
          id: 'chapter-1-section-1',
          title: '1.1 项目目标',
          summary: '说明建设目标',
          page_start: 1,
          page_end: 1,
          children: [],
        },
      ],
    },
  ],
};

const longDocumentationTree = {
  version: 1,
  nodes: [
    {
      id: 'chapter-1',
      title: '第一章 这是一个很长很长很长的标题用于验证目录节点省略后仍然可以展开查看完整内容',
      summary: '这是一段很长很长的摘要文本，用来验证目录节点在被省略显示时，仍然可以通过显式操作展开，确保用户能在目录内看到完整的说明内容，而不是只能看到截断后的片段。',
      page_start: 1,
      page_end: 6,
      children: [],
    },
  ],
};

describe('DocumentationPanel', () => {
  it('会渲染 JSON 树节点并默认展开子层级', () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    flushSync(() => {
      root.render(<DocumentationPanel tree={documentationTree} docId="doc-1" />);
    });

    expect(container.textContent).toContain('Directory');
    expect(container.querySelector('input')?.getAttribute('placeholder')).toBe('Filter nodes...');
    expect(container.textContent).toContain('第一章 项目背景');
    expect(container.textContent).toContain('1.1 项目目标');
    expect(container.textContent).toContain('P. 1-3');
    expect(container.textContent).toContain('P. 1');

    flushSync(() => {
      root.unmount();
    });
  });

  it('支持逐层收起和展开', () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    flushSync(() => {
      root.render(<DocumentationPanel tree={documentationTree} docId="doc-1" />);
    });

    const toggleButton = container.querySelector('button[aria-label="收起 第一章 项目背景"]');
    expect(toggleButton).not.toBeNull();

    flushSync(() => {
      toggleButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(toggleButton?.getAttribute('aria-expanded')).toBe('false');
    expect(container.textContent).not.toContain('1.1 项目目标');

    const expandButton = container.querySelector('button[aria-label="展开 第一章 项目背景"]');
    expect(expandButton).not.toBeNull();
    flushSync(() => {
      expandButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(expandButton?.getAttribute('aria-expanded')).toBe('true');
    expect(container.textContent).toContain('1.1 项目目标');

    flushSync(() => {
      root.unmount();
    });
  });

  it('通过单个切换按钮完成展开全部和收起全部', () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    flushSync(() => {
      root.render(<DocumentationPanel tree={documentationTree} docId="doc-2" />);
    });

    const treeToggleButton = container.querySelector('button[aria-label="收起全部"]');
    expect(treeToggleButton).not.toBeNull();

    flushSync(() => {
      treeToggleButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.querySelector('button[aria-label="展开全部"]')).not.toBeNull();
    expect(container.textContent).not.toContain('1.1 项目目标');

    flushSync(() => {
      container.querySelector('button[aria-label="展开全部"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.querySelector('button[aria-label="收起全部"]')).not.toBeNull();
    expect(container.textContent).toContain('1.1 项目目标');

    flushSync(() => {
      root.unmount();
    });
  });

  it('点击节点时会按页码区间触发跳转', () => {
    const onCitationClick = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);

    flushSync(() => {
      root.render(
        <DocumentationPanel
          tree={documentationTree}
          docId="doc-9"
          onCitationClick={onCitationClick}
        />
      );
    });

    const chapterButton = Array.from(container.querySelectorAll('[role="button"]')).find((element) =>
      element.textContent?.includes('第一章 项目背景')
    );
    expect(chapterButton).not.toBeNull();

    chapterButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onCitationClick).toHaveBeenCalledWith({
      label: '1-3',
      type: 'doc-9',
      page: '1-3',
      pageValue: '1-3',
    });

    flushSync(() => {
      root.unmount();
    });
  });

  it('支持展开被省略的长标题和摘要文本', () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    flushSync(() => {
      root.render(<DocumentationPanel tree={longDocumentationTree} docId="doc-3" />);
    });

    const expandTextButton = container.querySelector('button[aria-label^="展开文本"]');
    expect(expandTextButton).not.toBeNull();
    expect(expandTextButton?.textContent).toBe('展开');
    expect(expandTextButton?.className).toContain('opacity-75');

    flushSync(() => {
      expandTextButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const collapseTextButton = container.querySelector('button[aria-label^="收起文本"]');
    expect(collapseTextButton).not.toBeNull();
    expect(collapseTextButton?.textContent).toBe('收起');
    expect(container.textContent).toContain('这是一段很长很长的摘要文本');

    flushSync(() => {
      root.unmount();
    });
  });
});
