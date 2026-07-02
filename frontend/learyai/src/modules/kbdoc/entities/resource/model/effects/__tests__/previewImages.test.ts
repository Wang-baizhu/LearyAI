// previewImages.test.ts 负责验证预览图片分页读取、缓存命中与缓存清理逻辑。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getPreviewCredentials: vi.fn(),
  isOssProvider: vi.fn(),
  buildObjectKey: vi.fn(),
  createAwsPreviewReader: vi.fn(),
  createOssPreviewReader: vi.fn(),
  cacheOpen: vi.fn(),
  cacheMatch: vi.fn(),
  cachePut: vi.fn(),
  cacheDelete: vi.fn(),
  getItem: vi.fn(),
  setItem: vi.fn(),
  createObjectURL: vi.fn(),
  revokeObjectURL: vi.fn(),
}));

vi.mock('../previewCredentials', () => ({
  getPreviewCredentials: mocks.getPreviewCredentials,
}));

vi.mock('../previewObjectReader', () => ({
  buildObjectKey: mocks.buildObjectKey,
  isOssProvider: mocks.isOssProvider,
}));

vi.mock('../previewObjectReaderAws', () => ({
  createAwsPreviewReader: mocks.createAwsPreviewReader,
}));

vi.mock('../previewObjectReaderOss', () => ({
  createOssPreviewReader: mocks.createOssPreviewReader,
}));

import { clearPreviewImageCacheForDoc, fetchPreviewImagesPage } from '../previewImages';

describe('previewImages', () => {
  beforeEach(() => {
    mocks.getPreviewCredentials.mockReset();
    mocks.isOssProvider.mockReset();
    mocks.buildObjectKey.mockReset();
    mocks.createAwsPreviewReader.mockReset();
    mocks.createOssPreviewReader.mockReset();
    mocks.cacheOpen.mockReset();
    mocks.cacheMatch.mockReset();
    mocks.cachePut.mockReset();
    mocks.cacheDelete.mockReset();
    mocks.getItem.mockReset();
    mocks.setItem.mockReset();
    mocks.createObjectURL.mockReset();
    mocks.revokeObjectURL.mockReset();

    const cache = {
      match: mocks.cacheMatch,
      put: mocks.cachePut,
      delete: mocks.cacheDelete,
    };
    const NativeURL = globalThis.URL;
    class TestURL extends NativeURL {}
    Object.assign(TestURL, {
      createObjectURL: mocks.createObjectURL,
      revokeObjectURL: mocks.revokeObjectURL,
    });

    vi.stubGlobal('window', {
      caches: { open: mocks.cacheOpen.mockResolvedValue(cache) },
      localStorage: {
        getItem: mocks.getItem,
        setItem: mocks.setItem,
      },
      location: { origin: 'https://app.example.com' },
    });
    vi.stubGlobal('URL', TestURL);

    mocks.getPreviewCredentials.mockResolvedValue({
      provider: 'minio',
      accessKeyId: 'ak',
      secretAccessKey: 'sk',
      sessionToken: 'token',
      expiration: '2099-01-01T00:00:00Z',
      endpoint: 'https://minio.example.com',
      bucket: 'bucket',
      prefix: 'preview',
    });
    mocks.isOssProvider.mockReturnValue(false);
    mocks.buildObjectKey.mockImplementation((prefix, docId, index) => `${prefix}/${docId}/${index}.jpg`);
    mocks.createObjectURL.mockImplementation((blob: Blob) => `blob:${blob.size}`);
  });

  it('缓存未命中时会通过 reader 拉取图片、写入 cache 并返回分页结果', async () => {
    const blob = new Blob(['page-1'], { type: 'image/jpeg' });
    mocks.cacheMatch.mockResolvedValue(null);
    mocks.createAwsPreviewReader.mockReturnValue({
      fetchObjectAsBlob: vi.fn().mockResolvedValue(blob),
      isNotFoundError: vi.fn().mockReturnValue(false),
    });
    mocks.getItem.mockReturnValue(null);

    const result = await fetchPreviewImagesPage('doc-1', 1, 1, 'project-1');

    expect(result).toEqual({ urls: ['blob:6'], nextIndex: 2, hasMore: true });
    expect(mocks.cachePut).toHaveBeenCalledTimes(1);
    expect(mocks.setItem).toHaveBeenCalledTimes(1);
  });

  it('缓存命中时会直接复用缓存 Blob 且不会再次读取对象', async () => {
    const cachedBlob = new Blob(['cached'], { type: 'image/jpeg' });
    mocks.getItem.mockReturnValue(JSON.stringify({ totalSize: 6, entries: {} }));
    mocks.cacheMatch.mockResolvedValue({ blob: async () => cachedBlob });
    const fetchObjectAsBlob = vi.fn();
    mocks.createAwsPreviewReader.mockReturnValue({
      fetchObjectAsBlob,
      isNotFoundError: vi.fn().mockReturnValue(false),
    });

    const result = await fetchPreviewImagesPage('doc-1', 1, 1, 'project-1');

    expect(result.urls).toEqual(['blob:6']);
    expect(fetchObjectAsBlob).not.toHaveBeenCalled();
  });

  it('reader 返回 not found 时会终止分页并标记 hasMore=false', async () => {
    const fetchObjectAsBlob = vi.fn().mockRejectedValue({ code: 'NoSuchKey' });
    const isNotFoundError = vi.fn().mockReturnValue(true);
    mocks.cacheMatch.mockResolvedValue(null);
    mocks.createAwsPreviewReader.mockReturnValue({ fetchObjectAsBlob, isNotFoundError });
    mocks.getItem.mockReturnValue(null);

    const result = await fetchPreviewImagesPage('doc-1', 3, 2, 'project-1');
    expect(result).toEqual({ urls: [], nextIndex: 3, hasMore: false });
  });

  it('会按 docId/projectId 清理匹配的缓存项', async () => {
    mocks.getItem.mockReturnValue(
      JSON.stringify({
        totalSize: 10,
        entries: {
          a: { size: 4, ts: 1, docId: 'doc-1', projectId: 'project-1' },
          b: { size: 6, ts: 2, docId: 'doc-2', projectId: 'project-1' },
        },
      })
    );
    mocks.cacheDelete.mockResolvedValue(true);

    await clearPreviewImageCacheForDoc('doc-1', 'project-1');

    expect(mocks.cacheDelete).toHaveBeenCalledTimes(1);
    expect(mocks.setItem).toHaveBeenCalledWith(
      'kbdoc-preview-images-index-v1',
      JSON.stringify({
        totalSize: 6,
        entries: {
          b: { size: 6, ts: 2, docId: 'doc-2', projectId: 'project-1' },
        },
      })
    );
  });
});
