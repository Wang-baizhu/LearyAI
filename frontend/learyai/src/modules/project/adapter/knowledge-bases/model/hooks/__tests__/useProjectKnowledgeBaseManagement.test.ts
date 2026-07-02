// useProjectKnowledgeBaseManagement.test.ts 负责验证项目知识库适配层对知识库模块能力的收敛。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useCreateKnowledgeBase: vi.fn(),
  useDeleteKnowledgeBase: vi.fn(),
  useKnowledgeBaseList: vi.fn(),
  useUpdateKnowledgeBase: vi.fn(),
  resolveApiErrorMessage: vi.fn(),
}));

vi.mock('@/shared/api/resolveApiError', () => ({
  resolveApiErrorMessage: mocks.resolveApiErrorMessage,
}));

vi.mock('../../../../../../knowledge-base', () => ({
  useCreateKnowledgeBase: mocks.useCreateKnowledgeBase,
  useDeleteKnowledgeBase: mocks.useDeleteKnowledgeBase,
  useKnowledgeBaseList: mocks.useKnowledgeBaseList,
  useUpdateKnowledgeBase: mocks.useUpdateKnowledgeBase,
}));

import { useProjectKnowledgeBaseManagement } from '../useProjectKnowledgeBaseManagement';

describe('useProjectKnowledgeBaseManagement', () => {
  beforeEach(() => {
    mocks.useCreateKnowledgeBase.mockReset();
    mocks.useDeleteKnowledgeBase.mockReset();
    mocks.useKnowledgeBaseList.mockReset();
    mocks.useUpdateKnowledgeBase.mockReset();
    mocks.resolveApiErrorMessage.mockReset();

    mocks.useCreateKnowledgeBase.mockReturnValue({ mutate: vi.fn() });
    mocks.useUpdateKnowledgeBase.mockReturnValue({ mutate: vi.fn() });
    mocks.useDeleteKnowledgeBase.mockReturnValue({ mutate: vi.fn() });
    mocks.useKnowledgeBaseList.mockReturnValue({
      data: {
        items: [
          { kbId: 'kb-1', name: '知识库 A' },
          { kbId: 'kb-2', name: '知识库 B' },
        ],
        total: 7,
      },
      isError: false,
      error: null,
    });
  });

  it('会把项目详情参数转给知识库列表查询，并聚合分页与 mutation 契约', () => {
    const createMutation = { mutate: vi.fn() };
    const updateMutation = { mutate: vi.fn() };
    const deleteMutation = { mutate: vi.fn() };
    mocks.useCreateKnowledgeBase.mockReturnValue(createMutation);
    mocks.useUpdateKnowledgeBase.mockReturnValue(updateMutation);
    mocks.useDeleteKnowledgeBase.mockReturnValue(deleteMutation);

    const result = useProjectKnowledgeBaseManagement({
      projectId: 'project-1',
      search: '',
      page: 2,
      size: 3,
    });

    expect(mocks.useKnowledgeBaseList).toHaveBeenCalledWith({
      projectId: 'project-1',
      search: undefined,
      sort: 'visitedAt',
      order: 'desc',
      page: 2,
      size: 3,
    });
    expect(result.knowledgeBases).toEqual([
      { kbId: 'kb-1', name: '知识库 A' },
      { kbId: 'kb-2', name: '知识库 B' },
    ]);
    expect(result.total).toBe(7);
    expect(result.totalPages).toBe(3);
    expect(result.createMutation).toBe(createMutation);
    expect(result.updateMutation).toBe(updateMutation);
    expect(result.deleteMutation).toBe(deleteMutation);
    expect(result.listErrorMessage).toBeNull();
  });

  it('会在列表查询失败时生成错误文案', () => {
    const error = new Error('list failed');
    mocks.useKnowledgeBaseList.mockReturnValue({
      data: undefined,
      isError: true,
      error,
    });
    mocks.resolveApiErrorMessage.mockReturnValue('加载失败：mock');

    const result = useProjectKnowledgeBaseManagement({
      projectId: 'project-1',
      search: 'AI',
      page: 1,
      size: 6,
    });

    expect(mocks.useKnowledgeBaseList).toHaveBeenCalledWith({
      projectId: 'project-1',
      search: 'AI',
      sort: 'visitedAt',
      order: 'desc',
      page: 1,
      size: 6,
    });
    expect(mocks.resolveApiErrorMessage).toHaveBeenCalledWith(error, '加载失败，请稍后重试');
    expect(result.knowledgeBases).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(1);
    expect(result.listErrorMessage).toBe('加载失败：mock');
  });
});
