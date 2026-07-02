// previewObjectReaderAws.test.ts 负责验证 AWS 预览读取器的对象读取与错误识别。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const awsMocks = vi.hoisted(() => ({
  send: vi.fn(),
  lastConfig: null as Record<string, unknown> | null,
  lastCommandInput: null as Record<string, unknown> | null,
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    constructor(config: Record<string, unknown>) {
      awsMocks.lastConfig = config;
    }

    send = awsMocks.send;
  },
  GetObjectCommand: class {
    input: Record<string, unknown>;

    constructor(input: Record<string, unknown>) {
      this.input = input;
      awsMocks.lastCommandInput = input;
    }
  },
}));

import { createAwsPreviewReader } from '../previewObjectReaderAws';

describe('createAwsPreviewReader', () => {
  beforeEach(() => {
    awsMocks.send.mockReset();
    awsMocks.lastConfig = null;
    awsMocks.lastCommandInput = null;
  });

  it('会用凭证创建 S3 client 并把 transformToByteArray 响应转成 Blob', async () => {
    awsMocks.send.mockResolvedValue({
      Body: {
        transformToByteArray: async () => new Uint8Array([1, 2, 3]),
      },
      ContentType: 'image/png',
    });

    const reader = createAwsPreviewReader({
      accessKeyId: 'ak',
      secretAccessKey: 'sk',
      sessionToken: 'token',
      expiration: '2099-01-01T00:00:00Z',
      endpoint: 'https://s3.example.com',
      bucket: 'bucket',
      prefix: 'preview',
    });

    const blob = await reader.fetchObjectAsBlob('bucket', 'path/to/file.jpg');
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/png');
    expect(awsMocks.lastConfig).toMatchObject({
      region: 'us-east-1',
      endpoint: 'https://s3.example.com',
      forcePathStyle: true,
    });
    expect(awsMocks.lastCommandInput).toEqual({ Bucket: 'bucket', Key: 'path/to/file.jpg' });
  });

  it('会直接复用 Blob 响应体，并识别 404/NoSuchKey 错误', async () => {
    const rawBlob = new Blob(['hello'], { type: 'image/jpeg' });
    awsMocks.send.mockResolvedValue({ Body: rawBlob, ContentType: 'image/jpeg' });

    const reader = createAwsPreviewReader({
      accessKeyId: 'ak',
      secretAccessKey: 'sk',
      sessionToken: 'token',
      expiration: '2099-01-01T00:00:00Z',
      endpoint: 'https://s3.example.com',
      bucket: 'bucket',
      prefix: 'preview',
    });

    expect(await reader.fetchObjectAsBlob('bucket', 'key')).toBe(rawBlob);
    expect(reader.isNotFoundError({ name: 'NoSuchKey' })).toBe(true);
    expect(reader.isNotFoundError({ $metadata: { httpStatusCode: 404 } })).toBe(true);
    expect(reader.isNotFoundError({ name: 'AccessDenied' })).toBe(false);
  });

  it('无法解析响应体时会抛出明确错误', async () => {
    awsMocks.send.mockResolvedValue({ Body: 123, ContentType: 'image/jpeg' });

    const reader = createAwsPreviewReader({
      accessKeyId: 'ak',
      secretAccessKey: 'sk',
      sessionToken: 'token',
      expiration: '2099-01-01T00:00:00Z',
      endpoint: 'https://s3.example.com',
      bucket: 'bucket',
      prefix: 'preview',
    });

    await expect(reader.fetchObjectAsBlob('bucket', 'key')).rejects.toThrow('无法解析预览图片响应体');
  });
});
