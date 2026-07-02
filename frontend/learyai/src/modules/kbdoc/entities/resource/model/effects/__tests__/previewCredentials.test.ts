// previewCredentials.test.ts 负责验证预览临时凭证的缓存与重试逻辑。
import { afterEach, describe, expect, it, vi } from 'vitest';

const { getPreviewCredentialsMock } = vi.hoisted(() => ({
  getPreviewCredentialsMock: vi.fn(),
}));

vi.mock('../api', () => ({
  resourceApi: {
    getPreviewCredentials: getPreviewCredentialsMock,
  },
}));

import { getPreviewCredentials } from '../previewCredentials';

describe('previewCredentials', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    getPreviewCredentialsMock.mockReset();
  });

  it('会复用未过期的缓存凭证', async () => {
    getPreviewCredentialsMock.mockResolvedValue({
      provider: 'minio',
      accessKeyId: 'ak',
      secretAccessKey: 'sk',
      sessionToken: 'token',
      expiration: '2099-01-01T00:00:00.000Z',
      endpoint: 'https://minio.internal',
      bucket: 'bucket',
      prefix: 'preview',
    });

    const first = await getPreviewCredentials('doc-cache', 'project-1');
    const second = await getPreviewCredentials('doc-cache', 'project-1');

    expect(first).toBe(second);
    expect(getPreviewCredentialsMock).toHaveBeenCalledTimes(1);
  });

  it('会在请求失败时按重试间隔重试直到成功', async () => {
    vi.useFakeTimers();
    getPreviewCredentialsMock
      .mockRejectedValueOnce(new Error('first'))
      .mockRejectedValueOnce(new Error('second'))
      .mockResolvedValue({
        provider: 'minio',
        accessKeyId: 'ak',
        secretAccessKey: 'sk',
        sessionToken: 'token',
        expiration: '2099-01-01T00:00:00.000Z',
        endpoint: 'https://minio.internal',
        bucket: 'bucket',
        prefix: 'preview',
      });

    const promise = getPreviewCredentials('doc-retry', 'project-1');
    await vi.advanceTimersByTimeAsync(900);

    await expect(promise).resolves.toMatchObject({
      bucket: 'bucket',
      prefix: 'preview',
    });
    expect(getPreviewCredentialsMock).toHaveBeenCalledTimes(3);
  });
});
