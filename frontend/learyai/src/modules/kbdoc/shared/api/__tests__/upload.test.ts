// upload.test.ts 负责验证临时直传接口的 content-type、进度和 etag 解析。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  put: vi.fn(),
}));

vi.mock('axios', () => ({
  default: {
    put: mocks.put,
  },
}));

import { uploadToTempUrl } from '../upload';

describe('uploadToTempUrl', () => {
  beforeEach(() => {
    mocks.put.mockReset();
  });

  it('会优先使用传入的 contentType 并上报进度百分比', async () => {
    const file = new File(['hello'], 'demo.txt', { type: 'text/plain' });
    const onProgress = vi.fn();
    mocks.put.mockImplementation(async (_url, _file, config) => {
      config.onUploadProgress?.({ loaded: 1, total: 4 });
      config.onUploadProgress?.({ loaded: 4, total: 4 });
      return { headers: { etag: 'etag-1' } };
    });

    await expect(uploadToTempUrl('https://upload', file, ' application/json ', onProgress)).resolves.toBe('etag-1');
    expect(mocks.put).toHaveBeenCalledWith(
      'https://upload',
      file,
      expect.objectContaining({ headers: { 'Content-Type': 'application/json' } })
    );
    expect(onProgress).toHaveBeenNthCalledWith(1, 25);
    expect(onProgress).toHaveBeenNthCalledWith(2, 100);
  });

  it('会回退到 file.type / application/octet-stream，并兼容 ETag 头', async () => {
    const typedFile = new File(['hello'], 'demo.txt', { type: 'text/plain' });
    const emptyTypeFile = new File(['hello'], 'demo.bin', { type: '' });
    mocks.put
      .mockResolvedValueOnce({ headers: { ETag: 'etag-2' } })
      .mockResolvedValueOnce({ headers: {} });

    await expect(uploadToTempUrl('https://upload', typedFile)).resolves.toBe('etag-2');
    expect(mocks.put).toHaveBeenNthCalledWith(
      1,
      'https://upload',
      typedFile,
      expect.objectContaining({ headers: { 'Content-Type': 'text/plain' } })
    );

    await expect(uploadToTempUrl('https://upload', emptyTypeFile)).resolves.toBeNull();
    expect(mocks.put).toHaveBeenNthCalledWith(
      2,
      'https://upload',
      emptyTypeFile,
      expect.objectContaining({ headers: { 'Content-Type': 'application/octet-stream' } })
    );
  });
});
