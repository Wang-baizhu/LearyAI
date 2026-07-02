// previewObjectReaderOss 负责通过阿里云 OSS SDK 读取对象预览文件。
import OSS from 'ali-oss';
import type { PreviewCredentialsResponse } from '../types';
import type { PreviewObjectReader } from './previewObjectReader';

const resolveSecure = (endpoint: string) => endpoint.toLowerCase().startsWith('https://');

const resolveRegion = (credentials: PreviewCredentialsResponse) => {
  const endpoint = credentials.endpoint.trim().toLowerCase();
  const host = endpoint
    .replace('https://', '')
    .replace('http://', '')
    .replace(/^.+@/, '')
    .split('/')[0];
  const marker = 'oss-';
  const markerIndex = host.indexOf(marker);
  if (markerIndex >= 0) {
    const regionStart = markerIndex + marker.length;
    const dotIndex = host.indexOf('.', regionStart);
    if (dotIndex > regionStart) {
      return host.slice(regionStart, dotIndex);
    }
  }
  return 'cn-hangzhou';
};

const toBlob = (content: unknown): Blob => {
  if (content instanceof Blob) {
    return content;
  }
  if (content instanceof ArrayBuffer) {
    return new Blob([content], { type: 'image/jpeg' });
  }
  if (ArrayBuffer.isView(content)) {
    const view = content as ArrayBufferView;
    const sliced = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    const safeBytes = new Uint8Array(sliced);
    return new Blob([safeBytes], { type: 'image/jpeg' });
  }
  throw new Error('无法解析 OSS 预览响应体');
};

export const createOssPreviewReader = (
  credentials: PreviewCredentialsResponse
): PreviewObjectReader => {
  const client = new OSS({
    region: resolveRegion(credentials),
    endpoint: credentials.endpoint,
    accessKeyId: credentials.accessKeyId,
    accessKeySecret: credentials.secretAccessKey,
    stsToken: credentials.sessionToken,
    secure: resolveSecure(credentials.endpoint),
    bucket: credentials.bucket,
  });

  return {
    fetchObjectAsBlob: async (_bucket: string, key: string) => {
      const signedUrl = client.signatureUrl(key, {
        method: 'GET',
        expires: 60,
      });
      const response = await fetch(signedUrl);
      if (!response.ok) {
        const error = new Error(`OSS fetch failed: ${response.status}`);
        (error as { status?: number }).status = response.status;
        throw error;
      }
      return toBlob(await response.arrayBuffer());
    },
    isNotFoundError: (error: unknown) => {
      if (!error || typeof error !== 'object') return false;
      const code = (error as { code?: string }).code;
      if (code === 'NoSuchKey' || code === 'NotFound') {
        return true;
      }
      const status = (error as { status?: number }).status;
      return status === 404;
    },
  };
};
