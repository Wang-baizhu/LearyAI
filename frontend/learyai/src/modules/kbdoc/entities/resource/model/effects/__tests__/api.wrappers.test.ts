// api.wrappers.test.ts 负责验证知识库资源接口封装的请求参数与成功/失败分支。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  ensureTaskSseReady: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('@/shared/api/client', () => ({
  apiRequest: mocks.apiRequest,
}));

vi.mock('../taskSse', () => ({
  ensureTaskSseReady: mocks.ensureTaskSseReady,
}));

import { resourceApi } from '../api';

describe('resourceApi wrappers', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
    mocks.ensureTaskSseReady.mockReset();
    mocks.warn.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(mocks.warn);
  });

  it('会对常规查询接口解包 response.data', async () => {
    mocks.apiRequest
      .mockResolvedValueOnce({ data: ['doc-1', 'doc-2'] })
      .mockResolvedValueOnce({ data: { items: [{ docId: 'doc-1' }], total: 1, page: 1, size: 10 } })
      .mockResolvedValueOnce({ data: [{ docId: 'doc-1', name: '文档 1', status: 'DONE' }] })
      .mockResolvedValueOnce({ data: { docId: 'doc-1', name: '文档 1' } })
      .mockResolvedValueOnce({ data: true })
      .mockResolvedValueOnce({ data: { accessKeyId: 'ak', secretAccessKey: 'sk', sessionToken: 'st', expiration: '2099-01-01T00:00:00Z', endpoint: 'https://minio', bucket: 'bucket', prefix: 'preview' } });

    await expect(resourceApi.getRecentResourceIds(5, 'project-1')).resolves.toEqual(['doc-1', 'doc-2']);
    await expect(resourceApi.getResourceList({ search: 'AI' })).resolves.toEqual({
      items: [{ docId: 'doc-1' }],
      total: 1,
      page: 1,
      size: 10,
    });
    await expect(resourceApi.getResourceOptions({ projectId: 'project-1' })).resolves.toEqual([
      { docId: 'doc-1', name: '文档 1', status: 'DONE' },
    ]);
    await expect(resourceApi.getResourceDetail('doc-1', 'project-1')).resolves.toEqual({
      docId: 'doc-1',
      name: '文档 1',
    });
    await expect(resourceApi.deleteResource('doc-1', 'project-1')).resolves.toBe(true);
    await expect(resourceApi.getPreviewCredentials('doc-1', 'project-1')).resolves.toMatchObject({
      bucket: 'bucket',
    });
  });

  it('getResourceByDocId 会复用列表查询并回退为 null', async () => {
    mocks.apiRequest
      .mockResolvedValueOnce({ data: { items: [{ docId: 'doc-1', name: '文档 1' }], total: 1, page: 1, size: 1 } })
      .mockResolvedValueOnce({ data: { items: [], total: 0, page: 1, size: 1 } });

    await expect(resourceApi.getResourceByDocId('doc-1', 'kb-1', 'project-1')).resolves.toEqual({
      docId: 'doc-1',
      name: '文档 1',
    });
    await expect(resourceApi.getResourceByDocId('missing', 'kb-1', 'project-1')).resolves.toBeNull();
  });

  it('prepareUpload 会校验作用域并按预期携带 payload', async () => {
    await expect(
      resourceApi.prepareUpload({ fileType: 'pdf', size: 12, kbId: '', projectId: 'project-1' })
    ).rejects.toThrow('缺少知识库ID，无法准备上传');

    await expect(
      resourceApi.prepareUpload({ fileType: 'pdf', size: 12, kbId: 'kb-1', projectId: '' })
    ).rejects.toThrow('缺少项目ID，无法准备上传');

    mocks.apiRequest.mockResolvedValue({
      data: { docId: 'doc-1', taskId: 'task-1', objectKey: 'key-1', tempUrl: 'https://upload' },
    });

    await expect(
      resourceApi.prepareUpload({ fileType: 'pdf', size: 12, kbId: 'kb-1', projectId: 'project-1' })
    ).resolves.toMatchObject({ docId: 'doc-1', objectKey: 'key-1' });

    expect(mocks.apiRequest).toHaveBeenCalledWith('/kb/docs/upload/prepare', {
      method: 'POST',
      body: { fileType: 'pdf', size: 12, kbId: 'kb-1', projectId: 'project-1' },
    });
  });

  it('confirmUpload 在 SSE 初始化失败时会转换为稳定错误文案', async () => {
    mocks.ensureTaskSseReady.mockRejectedValue(new Error('network'));

    await expect(
      resourceApi.confirmUpload({
        docId: 'doc-1',
        objectKey: 'key-1',
        kbId: 'kb-1',
        projectId: 'project-1',
      })
    ).rejects.toThrow('SSE 连接失败，请稍后重试');

    expect(mocks.warn).toHaveBeenCalled();
    expect(mocks.apiRequest).not.toHaveBeenCalled();
  });

  it('importUrl 会透传 payload 并复用 SSE 准备逻辑', async () => {
    mocks.apiRequest.mockResolvedValue({
      data: { docId: 'doc-1', taskId: 7, status: 'PROCESSING' },
    });

    await expect(
      resourceApi.importUrl({
        projectId: 'project-1',
        kbId: 'kb-1',
        url: 'https://example.com/video',
      })
    ).resolves.toEqual({ docId: 'doc-1', taskId: 7, status: 'PROCESSING' });

    expect(mocks.ensureTaskSseReady).toHaveBeenCalledWith('project-1', 'kb-1', 10000);
    expect(mocks.apiRequest).toHaveBeenCalledWith('/kb/docs/import/url', {
      method: 'POST',
      body: {
        projectId: 'project-1',
        kbId: 'kb-1',
        url: 'https://example.com/video',
      },
    });
  });
});
