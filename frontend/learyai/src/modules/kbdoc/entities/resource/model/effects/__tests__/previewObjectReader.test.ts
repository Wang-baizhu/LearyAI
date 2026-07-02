// previewObjectReader.test.ts 负责验证预览对象读取器的纯辅助逻辑。
import { describe, expect, it } from 'vitest';
import { buildObjectKey, isOssProvider, normalizePrefix } from '../previewObjectReader';

describe('previewObjectReader helpers', () => {
  it('normalizePrefix 与 buildObjectKey 会规范化路径片段', () => {
    expect(normalizePrefix('preview')).toBe('preview/');
    expect(normalizePrefix('preview/')).toBe('preview/');
    expect(buildObjectKey('preview', '/doc-1/', 2)).toBe('preview/doc-1/2.jpg');
  });

  it('isOssProvider 会优先使用 provider，其次根据 endpoint 推断', () => {
    expect(
      isOssProvider({
        provider: ' OSS ',
        accessKeyId: '',
        secretAccessKey: '',
        sessionToken: '',
        expiration: '',
        endpoint: 'https://example.com',
        bucket: '',
        prefix: '',
      })
    ).toBe(true);

    expect(
      isOssProvider({
        accessKeyId: '',
        secretAccessKey: '',
        sessionToken: '',
        expiration: '',
        endpoint: 'https://oss-cn-hangzhou.aliyuncs.com',
        bucket: '',
        prefix: '',
      })
    ).toBe(true);

    expect(
      isOssProvider({
        accessKeyId: '',
        secretAccessKey: '',
        sessionToken: '',
        expiration: '',
        endpoint: 'https://minio.internal',
        bucket: '',
        prefix: '',
      })
    ).toBe(false);
  });
});
