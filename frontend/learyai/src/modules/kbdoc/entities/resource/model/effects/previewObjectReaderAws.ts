// previewObjectReaderAws 负责通过 AWS S3 兼容 SDK 读取对象预览文件。
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { PreviewCredentialsResponse } from '../types';
import type { PreviewObjectReader } from './previewObjectReader';

const DEFAULT_REGION = 'us-east-1';

const readBodyAsBlob = async (body: unknown, contentType: string | undefined): Promise<Blob> => {
  if (!body) {
    throw new Error('预览图片响应为空');
  }
  const typedBody = body as {
    transformToByteArray?: () => Promise<Uint8Array>;
  };
  if (typeof typedBody.transformToByteArray === 'function') {
    const bytes = await typedBody.transformToByteArray();
    const safeBytes = new Uint8Array(bytes);
    return new Blob([safeBytes], { type: contentType ?? 'image/jpeg' });
  }
  if (body instanceof Blob) {
    return body;
  }
  if (body instanceof ReadableStream) {
    const buffer = await new Response(body).arrayBuffer();
    return new Blob([buffer], { type: contentType ?? 'image/jpeg' });
  }
  throw new Error('无法解析预览图片响应体');
};

const createClient = (credentials: PreviewCredentialsResponse) =>
  new S3Client({
    region: DEFAULT_REGION,
    endpoint: credentials.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
    },
  });

export const createAwsPreviewReader = (
  credentials: PreviewCredentialsResponse
): PreviewObjectReader => {
  const client = createClient(credentials);
  return {
    fetchObjectAsBlob: async (bucket: string, key: string) => {
      const response = await client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
        })
      );
      return readBodyAsBlob(response.Body, response.ContentType);
    },
    isNotFoundError: (error: unknown) => {
      if (!error || typeof error !== 'object') return false;
      const name = (error as { name?: string }).name;
      if (name === 'NoSuchKey' || name === 'NotFound') return true;
      const metadata = (error as { $metadata?: { httpStatusCode?: number } }).$metadata;
      return metadata?.httpStatusCode === 404;
    },
  };
};
