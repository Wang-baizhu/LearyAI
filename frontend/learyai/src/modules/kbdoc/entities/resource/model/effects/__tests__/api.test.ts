// api.test.ts 负责验证知识库资源接口层的纯逻辑与轻量包装行为。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  apiRequestMock: vi.fn(),
  ensureTaskSseReadyMock: vi.fn(),
  refetchActiveTaskListMock: vi.fn(),
}));

let warnSpy: ReturnType<typeof vi.spyOn>;

vi.mock('@/shared/api/client', () => ({
  apiRequest: apiMocks.apiRequestMock,
}));

vi.mock('../taskSse', () => ({
  ensureTaskSseReady: apiMocks.ensureTaskSseReadyMock,
}));
vi.mock('@/shared/query/taskListRefetch', () => ({
  refetchActiveTaskList: apiMocks.refetchActiveTaskListMock,
}));

import { resourceApi, resolveUploadContentType, resolveUploadTempUrl } from '../api';

describe('kbdoc resource api helpers', () => {
  beforeEach(() => {
    apiMocks.apiRequestMock.mockReset();
    apiMocks.ensureTaskSseReadyMock.mockReset();
    apiMocks.refetchActiveTaskListMock.mockReset();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('resolveUploadTempUrl 会返回 trim 后的临时上传地址，并在缺失时抛错', () => {
    expect(
      resolveUploadTempUrl({
        docId: 'doc-1',
        taskId: 'task-1',
        objectKey: 'object-1',
        tempUrl: ' https://example.com/upload ',
      })
    ).toBe('https://example.com/upload');

    expect(() =>
      resolveUploadTempUrl({
        docId: 'doc-1',
        taskId: 'task-1',
        objectKey: 'object-1',
        tempUrl: '   ',
      })
    ).toThrow('未获取到临时上传地址（tempUrl）');
  });

  it('resolveUploadContentType 会优先读取 uploadPolicy header，其次回退 fallback', () => {
    expect(
      resolveUploadContentType(
        {
          docId: 'doc-1',
          taskId: 'task-1',
          objectKey: 'object-1',
          uploadPolicy: {
            headers: {
              'Content-Type': ' application/pdf ',
            },
          },
        },
        'text/plain'
      )
    ).toBe('application/pdf');

    expect(
      resolveUploadContentType(
        {
          docId: 'doc-1',
          taskId: 'task-1',
          objectKey: 'object-1',
        },
        ' text/plain '
      )
    ).toBe('text/plain');
    expect(
      resolveUploadContentType(
        {
          docId: 'doc-1',
          taskId: 'task-1',
          objectKey: 'object-1',
        },
        '   '
      )
    ).toBe('application/octet-stream');
  });

  it('prepareUpload 与 confirmUpload 会在缺少作用域参数时直接抛错', async () => {
    await expect(
      resourceApi.prepareUpload({
        fileType: 'pdf',
        size: 1,
        kbId: '',
        projectId: 'project-1',
      })
    ).rejects.toThrow('缺少知识库ID，无法准备上传');

    await expect(
      resourceApi.prepareUpload({
        fileType: 'pdf',
        size: 1,
        kbId: 'kb-1',
        projectId: '',
      })
    ).rejects.toThrow('缺少项目ID，无法准备上传');

    await expect(
      resourceApi.confirmUpload({
        docId: 'doc-1',
        objectKey: 'object-1',
        kbId: '',
        projectId: 'project-1',
      })
    ).rejects.toThrow('缺少知识库ID，无法确认上传');

    await expect(
      resourceApi.confirmUpload({
        docId: 'doc-1',
        objectKey: 'object-1',
        kbId: 'kb-1',
        projectId: '',
      })
    ).rejects.toThrow('缺少项目ID，无法确认上传');

    expect(apiMocks.ensureTaskSseReadyMock).not.toHaveBeenCalled();
    expect(apiMocks.apiRequestMock).not.toHaveBeenCalled();
  });

  it('resourceApi 会对常规接口统一解包 response.data', async () => {
    apiMocks.apiRequestMock
      .mockResolvedValueOnce({ data: ['doc-1'] })
      .mockResolvedValueOnce({ data: { items: [{ docId: 'doc-1' }], total: 1, page: 1, size: 12 } })
      .mockResolvedValueOnce({ data: [{ docId: 'doc-1', name: '文档一' }] })
      .mockResolvedValueOnce({ data: { docId: 'doc-1', name: '文档一详情' } })
      .mockResolvedValueOnce({ data: true })
      .mockResolvedValueOnce({ data: { accessKeyId: 'ak' } });

    await expect(resourceApi.getRecentResourceIds(5, 'project-1')).resolves.toEqual(['doc-1']);
    await expect(
      resourceApi.getResourceList({ projectId: 'project-1', kbId: 'kb-1', page: 1 })
    ).resolves.toEqual({
      items: [{ docId: 'doc-1' }],
      total: 1,
      page: 1,
      size: 12,
    });
    await expect(
      resourceApi.getResourceOptions({ projectId: 'project-1', kbId: 'kb-1' })
    ).resolves.toEqual([{ docId: 'doc-1', name: '文档一' }]);
    await expect(resourceApi.getResourceDetail('doc-1', 'project-1')).resolves.toEqual({
      docId: 'doc-1',
      name: '文档一详情',
    });
    await expect(resourceApi.deleteResource('doc-1', 'project-1')).resolves.toBe(true);
    await expect(resourceApi.getPreviewCredentials('doc-1', 'project-1')).resolves.toEqual({
      accessKeyId: 'ak',
    });

    expect(apiMocks.apiRequestMock).toHaveBeenNthCalledWith(1, '/kb/recent', {
      params: { limit: 5, projectId: 'project-1' },
    });
    expect(apiMocks.apiRequestMock).toHaveBeenNthCalledWith(2, '/kb/docs', {
      params: { projectId: 'project-1', kbId: 'kb-1', page: 1 },
    });
    expect(apiMocks.apiRequestMock).toHaveBeenNthCalledWith(3, '/kb/docs/options', {
      params: { projectId: 'project-1', kbId: 'kb-1' },
    });
    expect(apiMocks.apiRequestMock).toHaveBeenNthCalledWith(4, '/kb/docs/doc-1', {
      params: { projectId: 'project-1' },
    });
    expect(apiMocks.apiRequestMock).toHaveBeenNthCalledWith(5, '/kb/docs/doc-1', {
      method: 'DELETE',
      params: { projectId: 'project-1' },
    });
    expect(apiMocks.apiRequestMock).toHaveBeenNthCalledWith(6, '/kb/docs/preview/credentials', {
      method: 'POST',
      body: { docId: 'doc-1', projectId: 'project-1' },
    });
  });

  it('getResourceByDocId 会复用列表接口并回退为 null', async () => {
    apiMocks.apiRequestMock
      .mockResolvedValueOnce({
        data: {
          items: [{ docId: 'doc-1', name: '文档一' }],
          total: 1,
          page: 1,
          size: 1,
        },
      })
      .mockResolvedValueOnce({
        data: {
          items: [],
          total: 0,
          page: 1,
          size: 1,
        },
      });

    await expect(resourceApi.getResourceByDocId('doc-1', 'kb-1', 'project-1')).resolves.toEqual({
      docId: 'doc-1',
      name: '文档一',
    });
    await expect(resourceApi.getResourceByDocId('doc-2', 'kb-1', 'project-1')).resolves.toBeNull();
  });

  it('prepareUpload 与 confirmUpload 会调用对应接口，confirmUpload 成功前要求 SSE 就绪', async () => {
    apiMocks.apiRequestMock
      .mockResolvedValueOnce({ data: { docId: 'doc-1', taskId: 'task-1', objectKey: 'object-1' } })
      .mockResolvedValueOnce({ data: { taskId: 'task-2', docId: 'doc-1' } });

    await expect(
      resourceApi.prepareUpload({
        fileType: 'pdf',
        size: 1024,
        kbId: 'kb-1',
        projectId: 'project-1',
      })
    ).resolves.toEqual({ docId: 'doc-1', taskId: 'task-1', objectKey: 'object-1' });

    await expect(
      resourceApi.confirmUpload({
        docId: 'doc-1',
        objectKey: 'object-1',
        kbId: 'kb-1',
        projectId: 'project-1',
      })
    ).resolves.toEqual({ taskId: 'task-2', docId: 'doc-1' });

    expect(apiMocks.ensureTaskSseReadyMock).toHaveBeenCalledWith('project-1', 'kb-1', 10000);
    expect(apiMocks.apiRequestMock).toHaveBeenNthCalledWith(1, '/kb/docs/upload/prepare', {
      method: 'POST',
      body: {
        fileType: 'pdf',
        size: 1024,
        kbId: 'kb-1',
        projectId: 'project-1',
      },
    });
    expect(apiMocks.apiRequestMock).toHaveBeenNthCalledWith(2, '/kb/docs/upload/confirm', {
      method: 'POST',
      body: {
        docId: 'doc-1',
        objectKey: 'object-1',
        kbId: 'kb-1',
        projectId: 'project-1',
      },
    });
    expect(apiMocks.refetchActiveTaskListMock).toHaveBeenCalledWith('project-1', 'kb-1');
  });

  it('confirmUpload 在 SSE 初始化失败时会转换为统一错误', async () => {
    apiMocks.ensureTaskSseReadyMock.mockRejectedValue(new Error('timeout'));

    await expect(
      resourceApi.confirmUpload({
        docId: 'doc-1',
        objectKey: 'object-1',
        kbId: 'kb-1',
        projectId: 'project-1',
      })
    ).rejects.toThrow('SSE 连接失败，请稍后重试');

    expect(apiMocks.apiRequestMock).not.toHaveBeenCalled();
  });

  it('importUrl 会要求 SSE 就绪并调用链接导入接口', async () => {
    apiMocks.apiRequestMock.mockResolvedValueOnce({
      data: { docId: 'doc-1', taskId: 3, status: 'PROCESSING' },
    });

    await expect(
      resourceApi.importUrl({
        projectId: 'project-1',
        kbId: 'kb-1',
        url: 'https://example.com/video',
        name: '示例视频',
      })
    ).resolves.toEqual({ docId: 'doc-1', taskId: 3, status: 'PROCESSING' });

    expect(apiMocks.ensureTaskSseReadyMock).toHaveBeenCalledWith('project-1', 'kb-1', 10000);
    expect(apiMocks.apiRequestMock).toHaveBeenCalledWith('/kb/docs/import/url', {
      method: 'POST',
      body: {
        projectId: 'project-1',
        kbId: 'kb-1',
        url: 'https://example.com/video',
        name: '示例视频',
      },
    });
    expect(apiMocks.refetchActiveTaskListMock).toHaveBeenCalledWith('project-1', 'kb-1');
  });

  it('importText 会要求 SSE 就绪并调用文本导入接口', async () => {
    apiMocks.apiRequestMock.mockResolvedValueOnce({
      data: { docId: 'doc-2', taskId: 4, status: 'PROCESSING' },
    });

    await expect(
      resourceApi.importText({
        projectId: 'project-1',
        kbId: 'kb-1',
        text: '  这是一段测试文本  ',
        name: '测试文本...',
      })
    ).resolves.toEqual({ docId: 'doc-2', taskId: 4, status: 'PROCESSING' });

    expect(apiMocks.ensureTaskSseReadyMock).toHaveBeenCalledWith('project-1', 'kb-1', 10000);
    expect(apiMocks.apiRequestMock).toHaveBeenCalledWith('/kb/docs/import/text', {
      method: 'POST',
      body: {
        projectId: 'project-1',
        kbId: 'kb-1',
        text: '  这是一段测试文本  ',
        name: '测试文本...',
      },
    });
    expect(apiMocks.refetchActiveTaskListMock).toHaveBeenCalledWith('project-1', 'kb-1');
  });
});
