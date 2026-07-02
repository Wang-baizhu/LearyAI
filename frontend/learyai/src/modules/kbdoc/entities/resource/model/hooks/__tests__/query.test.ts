// query.test.ts 负责验证知识库资源 query/mutation 配置与缓存修剪行为。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn((options) => options),
  useMutation: vi.fn((options) => options),
  useQueryClient: vi.fn(),
  invalidateQueries: vi.fn(),
  setQueriesData: vi.fn(),
  removeQueries: vi.fn(),
  getRecentResourceIds: vi.fn(),
  getResourceByDocId: vi.fn(),
  getResourceList: vi.fn(),
  getResourceOptions: vi.fn(),
  getResourceDetail: vi.fn(),
  deleteResource: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: mocks.useQuery,
  useMutation: mocks.useMutation,
  useQueryClient: mocks.useQueryClient,
}));

vi.mock('../../effects/api', () => ({
  resourceApi: {
    getRecentResourceIds: mocks.getRecentResourceIds,
    getResourceByDocId: mocks.getResourceByDocId,
    getResourceList: mocks.getResourceList,
    getResourceOptions: mocks.getResourceOptions,
    getResourceDetail: mocks.getResourceDetail,
    deleteResource: mocks.deleteResource,
  },
}));

import {
  useDeleteResource,
  useKbdocList,
  useKbdocOptions,
  useRecentResources,
  useResourceDetailByDocId,
} from '../query';

describe('kbdoc query hooks', () => {
  beforeEach(() => {
    mocks.useQuery.mockReset();
    mocks.useQuery.mockImplementation((options) => options);
    mocks.useMutation.mockReset();
    mocks.useMutation.mockImplementation((options) => options);
    mocks.useQueryClient.mockReset();
    mocks.useQueryClient.mockReturnValue({
      invalidateQueries: mocks.invalidateQueries,
      setQueriesData: mocks.setQueriesData,
      removeQueries: mocks.removeQueries,
    });
    mocks.invalidateQueries.mockReset();
    mocks.setQueriesData.mockReset();
    mocks.removeQueries.mockReset();
    mocks.getRecentResourceIds.mockReset();
    mocks.getResourceByDocId.mockReset();
    mocks.getResourceList.mockReset();
    mocks.getResourceOptions.mockReset();
    mocks.getResourceDetail.mockReset();
    mocks.deleteResource.mockReset();
  });

  it('useRecentResources 会在有 projectId 时启用，并过滤掉查不到的资源', async () => {
    mocks.getRecentResourceIds.mockResolvedValue(['doc-1', 'doc-2']);
    mocks.getResourceByDocId
      .mockResolvedValueOnce({ docId: 'doc-1', name: '文档 1' })
      .mockResolvedValueOnce(null);

    useRecentResources(2, 'project-1');
    const queryOptions = mocks.useQuery.mock.calls[0][0];
    expect(queryOptions.queryKey).toEqual(['resource', 'recent', 'project-1']);
    expect(queryOptions.enabled).toBe(true);
    await expect(queryOptions.queryFn()).resolves.toEqual([{ docId: 'doc-1', name: '文档 1' }]);
  });

  it('useKbdocList / useKbdocOptions / useResourceDetailByDocId 会生成稳定 query 配置', async () => {
    mocks.getResourceList.mockResolvedValue({ items: [], total: 0, page: 1, size: 10 });
    mocks.getResourceOptions.mockResolvedValue([{ docId: 'doc-1', name: '文档 1', status: 'DONE' }]);
    mocks.getResourceDetail.mockResolvedValue({ docId: 'doc-1', name: '文档 1' });

    useKbdocList({ projectId: 'project-1', search: 'AI' }, { enabled: false });
    const listQueryOptions = mocks.useQuery.mock.calls[0][0];
    expect(listQueryOptions.queryKey).toEqual(['resource', 'list', { projectId: 'project-1', search: 'AI' }]);
    expect(listQueryOptions.enabled).toBe(false);
    await expect(listQueryOptions.queryFn()).resolves.toEqual({ items: [], total: 0, page: 1, size: 10 });

    useKbdocOptions({ projectId: 'project-1' });
    const optionsQueryOptions = mocks.useQuery.mock.calls[1][0];
    expect(optionsQueryOptions.enabled).toBe(true);
    await expect(optionsQueryOptions.queryFn()).resolves.toEqual([{ docId: 'doc-1', name: '文档 1', status: 'DONE' }]);

    useResourceDetailByDocId(undefined, 'kb-1', 'project-1');
    const detailQueryOptions = mocks.useQuery.mock.calls[2][0];
    expect(detailQueryOptions.enabled).toBe(false);
    await expect(detailQueryOptions.queryFn()).resolves.toBeNull();

    useResourceDetailByDocId('doc-1', 'kb-1', 'project-1');
    const activeDetailQueryOptions = mocks.useQuery.mock.calls[3][0];
    expect(activeDetailQueryOptions.queryKey).toEqual(['resource', 'detail', 'doc-1-kb-1', 'project-1']);
    await expect(activeDetailQueryOptions.queryFn()).resolves.toEqual({ docId: 'doc-1', name: '文档 1' });
  });

  it('useDeleteResource 成功后会刷新并修剪列表/最近项/详情缓存', () => {
    useDeleteResource('project-1');
    const mutationOptions = mocks.useMutation.mock.calls[0][0];
    mutationOptions.onSuccess?.(true, { docId: 'doc-1' });

    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['resource'] });

    const pruneListUpdater = mocks.setQueriesData.mock.calls[0][1];
    expect(
      pruneListUpdater({
        items: [
          { docId: 'doc-1', name: '文档 1' },
          { docId: 'doc-2', name: '文档 2' },
        ],
        total: 2,
      })
    ).toEqual({
      items: [{ docId: 'doc-2', name: '文档 2' }],
      total: 1,
    });

    const pruneRecentUpdater = mocks.setQueriesData.mock.calls[1][1];
    expect(pruneRecentUpdater([{ docId: 'doc-1' }, { docId: 'doc-2' }])).toEqual([{ docId: 'doc-2' }]);

    const predicate = mocks.removeQueries.mock.calls[0][0].predicate;
    expect(predicate({ queryKey: ['resource', 'detail', 'doc-1-kb-1', 'project-1'] })).toBe(true);
    expect(predicate({ queryKey: ['resource', 'detail', 'doc-2-kb-1', 'project-1'] })).toBe(false);
  });
});
