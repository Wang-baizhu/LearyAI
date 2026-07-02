import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TaskListButton from '../TaskListButton';

const mocks = vi.hoisted(() => ({
  useState: vi.fn(),
  useTaskList: vi.fn(),
  useScopedDocNameMap: vi.fn(),
  retryFailedTask: vi.fn(),
  dispatch: vi.fn(),
  enqueueToast: vi.fn((payload: unknown) => payload),
}));

const buildTaskListQueryResult = (items: Array<Record<string, unknown>>, overrides: Record<string, unknown> = {}) => ({
  data: {
    pages: [
      {
        items,
        total: items.length,
        page: 1,
        size: 20,
      },
    ],
    pageParams: [1],
  },
  isLoading: false,
  isError: false,
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: vi.fn(),
  ...overrides,
});

vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useState: mocks.useState,
  };
});

vi.mock('../../../../entities', () => ({
  useTaskList: mocks.useTaskList,
  taskApi: {
    retryFailedTask: mocks.retryFailedTask,
  },
}));

vi.mock('@/modules/resource', () => ({
  useScopedDocNameMap: mocks.useScopedDocNameMap,
}));

vi.mock('@/shared/ui/LoadingSpinner', () => ({
  default: ({ size }: { size: number }) => <span>loading-spinner:{size}</span>,
}));

vi.mock('@leary/ui', () => ({
  Modal: ({
    isOpen,
    title,
    children,
  }: {
    isOpen: boolean;
    title?: string;
    children: React.ReactNode;
  }) => (isOpen ? <div data-modal-title={title}>{children}</div> : null),
}));

vi.mock('@/shared/ui/icons/MaterialIcon', () => ({
  default: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock('@/app/store/hooks', () => ({
  useAppDispatch: () => mocks.dispatch,
}));

vi.mock('@/app/store/ui/toastSlice', () => ({
  enqueueToast: mocks.enqueueToast,
}));

describe('TaskListButton', () => {
  beforeEach(() => {
    mocks.useState.mockReset();
    mocks.useState.mockImplementation((initialValue: unknown) => [
      typeof initialValue === 'function' ? (initialValue as () => unknown)() : initialValue,
      vi.fn(),
    ]);
    mocks.useTaskList.mockReset();
    mocks.retryFailedTask.mockReset();
    mocks.useScopedDocNameMap.mockReset();
    mocks.useScopedDocNameMap.mockReturnValue({
      'doc-1': '产品文档',
    });
    mocks.dispatch.mockClear();
    mocks.enqueueToast.mockClear();
  });

  it('renders the closed task entry safely', () => {
    mocks.useTaskList.mockReturnValue(buildTaskListQueryResult([]));

    const render = () => renderToStaticMarkup(<TaskListButton projectId="project-1" kbId="kb-1" />);

    expect(render).not.toThrow();
    const markup = render();
    expect(markup).toContain('任务');
    expect(markup).toContain('(0)');
    expect(markup).toContain('history');
    expect(mocks.useTaskList).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'project-1',
        kbId: 'kb-1',
        size: 20,
      }),
      { enabled: true }
    );
  });

  it('keeps the count visible when compact mobile mode is enabled', () => {
    mocks.useTaskList.mockReturnValue(buildTaskListQueryResult([], {
      data: {
        pages: [
          {
            items: [],
            total: 8,
            page: 1,
            size: 20,
          },
        ],
        pageParams: [1],
      },
    }));

    const markup = renderToStaticMarkup(
      <TaskListButton projectId="project-1" kbId="kb-1" compactOnMobile />
    );

    expect(markup).toContain('(8)');
    expect(markup).toContain('hidden text-[11px] font-black uppercase tracking-[0.3em] sm:inline');
  });

  it('renders the opened panel with a failed task branch', () => {
    mocks.useState
      .mockImplementationOnce(() => [true, vi.fn()])
      .mockImplementationOnce(() => [null, vi.fn()]);
    mocks.useTaskList.mockReturnValue(buildTaskListQueryResult([
      {
        taskId: 'task-9',
        type: 'template_pipeline',
        typeId: 'tpl-1',
        status: 'FAILED',
        currentStage: 'agent:template:plugin-mindmap',
        viewData: {
          docRefs: [{ id: 'doc-1' }],
        },
        createdAt: '2026-03-28T08:00:00.000Z',
        updatedAt: '2026-03-28T08:01:00.000Z',
      },
    ]));

    const markup = renderToStaticMarkup(<TaskListButton projectId="project-1" kbId="kb-1" />);

    expect(markup).toContain('任务列表');
    expect(markup).not.toContain('data-modal-title="任务列表"');
    expect(markup).toContain('思维导图生成失败');
    expect(markup).toContain('参考文档：产品文档');
    expect(markup).toContain('重新处理');
    expect(markup).toContain('失败');
  });

  it('renders url doc names in shortened form with full title in task details', () => {
    mocks.useState
      .mockImplementationOnce(() => [true, vi.fn()])
      .mockImplementationOnce(() => [null, vi.fn()]);
    mocks.useScopedDocNameMap.mockReturnValue({
      'doc-1': 'https://www.bilibili.com/video/BV1rRM2z6EW6?spm_id_from=333.1387.homepage.video_card.click',
    });
    mocks.useTaskList.mockReturnValue(buildTaskListQueryResult([
      {
        taskId: 'task-10',
        type: 'document_pipeline',
        typeId: 'doc-1',
        status: 'DONE',
        currentStage: 'doc:main',
        viewData: null,
        createdAt: '2026-03-28T08:00:00.000Z',
        updatedAt: '2026-03-28T08:01:00.000Z',
      },
    ]));

    const markup = renderToStaticMarkup(<TaskListButton projectId="project-1" kbId="kb-1" />);

    expect(markup).toContain('文档处理完成');
    expect(markup).toContain('文档：https://www.bilibili.com/video/BV1rRM2z6EW6...');
    expect(markup).toContain('title="文档：https://www.bilibili.com/video/BV1rRM2z6EW6?spm_id_from=333.1387.homepage.video_card.click"');
  });

  it('renders kbview task labels as relation graph generation', () => {
    mocks.useState
      .mockImplementationOnce(() => [true, vi.fn()])
      .mockImplementationOnce(() => [null, vi.fn()]);
    mocks.useTaskList.mockReturnValue(buildTaskListQueryResult([
      {
        taskId: 'task-11',
        type: 'agent_pipeline',
        typeId: '_',
        status: 'DONE',
        currentStage: 'agent:kbview',
        viewData: {
          docRefs: [{ id: 'doc-1' }],
        },
        createdAt: '2026-03-28T08:00:00.000Z',
        updatedAt: '2026-03-28T08:01:00.000Z',
      },
    ]));

    const markup = renderToStaticMarkup(<TaskListButton projectId="project-1" kbId="kb-1" />);

    expect(markup).toContain('关系图生成完成');
    expect(markup).toContain('参考文档：产品文档');
  });

  it('renders agent_pipeline fallback labels as intelligent-agent task generation', () => {
    mocks.useState
      .mockImplementationOnce(() => [true, vi.fn()])
      .mockImplementationOnce(() => [null, vi.fn()]);
    mocks.useTaskList.mockReturnValue(buildTaskListQueryResult([
      {
        taskId: 'task-13',
        type: 'agent_pipeline',
        typeId: '_',
        status: 'FAILED',
        currentStage: null,
        viewData: null,
        createdAt: '2026-03-28T08:00:00.000Z',
        updatedAt: '2026-03-28T08:01:00.000Z',
      },
    ]));

    const markup = renderToStaticMarkup(<TaskListButton projectId="project-1" kbId="kb-1" />);

    expect(markup).toContain('智能体任务生成失败');
  });

  it('renders card task labels as flashcard generation', () => {
    mocks.useState
      .mockImplementationOnce(() => [true, vi.fn()])
      .mockImplementationOnce(() => [null, vi.fn()]);
    mocks.useTaskList.mockReturnValue(buildTaskListQueryResult([
      {
        taskId: 'task-12',
        type: 'template_pipeline',
        typeId: '_',
        status: 'DONE',
        currentStage: 'agent:template:plugin-card',
        viewData: {
          docRefs: [{ id: 'doc-1' }],
        },
        createdAt: '2026-03-28T08:00:00.000Z',
        updatedAt: '2026-03-28T08:01:00.000Z',
      },
    ]));

    const markup = renderToStaticMarkup(<TaskListButton projectId="project-1" kbId="kb-1" />);

    expect(markup).toContain('卡片生成完成');
    expect(markup).toContain('参考文档：产品文档');
  });
});
