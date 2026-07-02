// useWorkspaceProjects.test.tsx 负责验证工作区项目适配层对项目列表查询结果的映射。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useProjects: vi.fn(),
}));

vi.mock('../../../../../project', () => ({
  useProjects: mocks.useProjects,
}));

import { useWorkspaceProjects } from '../useWorkspaceProjects';

const renderUseWorkspaceProjects = (
  ...args: Parameters<typeof useWorkspaceProjects>
) => {
  let result: ReturnType<typeof useWorkspaceProjects> | null = null;

  const TestComponent = () => {
    result = useWorkspaceProjects(...args);
    return null;
  };

  renderToStaticMarkup(<TestComponent />);

  if (!result) {
    throw new Error('expected hook result');
  }

  return result;
};

describe('useWorkspaceProjects', () => {
  beforeEach(() => {
    mocks.useProjects.mockReset();
    mocks.useProjects.mockReturnValue({
      data: [
        {
          projectId: 'project-1',
          name: 'Alpha 空间',
          role: 'OWNER',
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-02T00:00:00.000Z',
        },
        {
          projectId: 'project-2',
          name: 'Beta 空间',
          role: 'ADMIN',
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
    });
  });

  it('会透传分页参数，并把第一页第一项映射为默认项目', () => {
    const result = renderUseWorkspaceProjects(2, 50, false);

    expect(mocks.useProjects).toHaveBeenCalledWith(2, 50, false);
    expect(result.projects).toEqual([
      {
        projectId: 'project-1',
        name: 'Alpha 空间',
        role: 'OWNER',
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-02T00:00:00.000Z',
      },
      {
        projectId: 'project-2',
        name: 'Beta 空间',
        role: 'ADMIN',
        createdAt: undefined,
        updatedAt: undefined,
      },
    ]);
    expect(result.defaultProjectId).toBe('project-1');
    expect(result.isLoading).toBe(false);
    expect(result.isError).toBe(false);
    expect(result.error).toBeNull();
  });

  it('会在项目列表为空时返回空默认项目，并保留查询错误态', () => {
    const error = new Error('boom');
    mocks.useProjects.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error,
    });

    const result = renderUseWorkspaceProjects();

    expect(result.projects).toEqual([]);
    expect(result.defaultProjectId).toBeNull();
    expect(result.isError).toBe(true);
    expect(result.error).toBe(error);
  });
});
