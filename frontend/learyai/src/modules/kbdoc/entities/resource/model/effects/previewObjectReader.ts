// previewObjectReader 负责抽象不同对象存储 SDK 的统一读取能力。
import type { PreviewCredentialsResponse } from '../types';

export interface PreviewObjectReader {
  fetchObjectAsBlob: (bucket: string, key: string) => Promise<Blob>;
  isNotFoundError: (error: unknown) => boolean;
}

export const normalizePrefix = (prefix: string) => (prefix.endsWith('/') ? prefix : `${prefix}/`);

const normalizeSegment = (segment: string) => segment.trim().replace(/^\/+|\/+$/g, '');

export const buildObjectKey = (prefix: string, docId: string, index: number) => {
  const normalizedDocId = normalizeSegment(docId);
  return `${normalizePrefix(prefix)}${normalizedDocId}/${index}.jpg`;
};

const resolveProvider = (credentials: PreviewCredentialsResponse) => {
  const provider = credentials.provider?.trim().toLowerCase();
  if (provider) {
    return provider;
  }
  const endpoint = credentials.endpoint.toLowerCase();
  if (endpoint.includes('aliyuncs.com')) {
    return 'oss';
  }
  return 'minio';
};

export const isOssProvider = (credentials: PreviewCredentialsResponse) =>
  resolveProvider(credentials) === 'oss';
