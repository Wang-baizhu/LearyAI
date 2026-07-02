// previewObjectReaderOss.test.ts 负责验证 OSS 预览读取器的 region 解析、下载与错误识别。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ossMocks = vi.hoisted(() => ({
  signatureUrl: vi.fn(),
  config: null as Record<string, unknown> | null,
}));

vi.mock('ali-oss', () => ({
  default: class {
    constructor(config: Record<string, unknown>) {
      ossMocks.config = config;
    }

    signatureUrl = ossMocks.signatureUrl;
  },
}));

import { createOssPreviewReader } from '../previewObjectReaderOss';

describe('createOssPreviewReader', () => {
  beforeEach(() => {
    ossMocks.signatureUrl.mockReset();
    ossMocks.config = null;
    vi.stubGlobal('fetch', vi.fn());
  });

  it('会解析 endpoint 生成 region/secure，并通过签名地址下载 Blob', async () => {
    ossMocks.signatureUrl.mockReturnValue('https://signed.example.com/object');
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    } as Response);

    const reader = createOssPreviewReader({
      accessKeyId: 'ak',
      secretAccessKey: 'sk',
      sessionToken: 'token',
      expiration: '2099-01-01T00:00:00Z',
      endpoint: 'https://oss-cn-shanghai.aliyuncs.com',
      bucket: 'bucket',
      prefix: 'preview',
    });

    const blob = await reader.fetchObjectAsBlob('ignored', 'path/to/file.jpg');
    expect(blob).toBeInstanceOf(Blob);
    expect(ossMocks.config).toMatchObject({
      region: 'cn-shanghai',
      secure: true,
      bucket: 'bucket',
    });
    expect(ossMocks.signatureUrl).toHaveBeenCalledWith('path/to/file.jpg', {
      method: 'GET',
      expires: 60,
    });
  });

  it('下载失败时会抛出带 status 的错误，并识别 404/NoSuchKey', async () => {
    ossMocks.signatureUrl.mockReturnValue('https://signed.example.com/object');
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 404 } as Response);

    const reader = createOssPreviewReader({
      accessKeyId: 'ak',
      secretAccessKey: 'sk',
      sessionToken: 'token',
      expiration: '2099-01-01T00:00:00Z',
      endpoint: 'http://oss-cn-hangzhou.aliyuncs.com',
      bucket: 'bucket',
      prefix: 'preview',
    });

    let error: Error & { status?: number };
    try {
      await reader.fetchObjectAsBlob('ignored', 'missing');
      throw new Error('expected fetchObjectAsBlob to throw');
    } catch (value) {
      error = value as Error & { status?: number };
    }
    expect(error.message).toContain('OSS fetch failed: 404');
    expect(error.status).toBe(404);
    expect(reader.isNotFoundError(error)).toBe(true);
    expect(reader.isNotFoundError({ code: 'NoSuchKey' })).toBe(true);
    expect(reader.isNotFoundError({ status: 500 })).toBe(false);
    expect(ossMocks.config).toMatchObject({ secure: false, region: 'cn-hangzhou' });
  });
});
