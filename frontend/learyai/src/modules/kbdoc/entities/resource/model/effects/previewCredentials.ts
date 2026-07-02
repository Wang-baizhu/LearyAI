// previewCredentials 负责获取并缓存文档预览临时凭证与刷新逻辑。
import { resourceApi } from './api';
import type { PreviewCredentialsResponse } from '../types';

const REFRESH_BUFFER_MS = 5 * 60 * 1000;
const RETRY_DELAYS_MS = [300, 600, 1200];

interface CachedCredentials {
  credentials?: PreviewCredentialsResponse;
  expiresAt?: number;
  refreshPromise?: Promise<PreviewCredentialsResponse>;
}

const credentialCache = new Map<string, CachedCredentials>();

const parseExpiration = (expiration: string) => {
  const time = Date.parse(expiration);
  return Number.isFinite(time) ? time : 0;
};

const shouldRefresh = (expiresAt?: number) => !expiresAt || Date.now() >= expiresAt - REFRESH_BUFFER_MS;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const withRetry = async <T>(task: () => Promise<T>): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt >= RETRY_DELAYS_MS.length) {
        break;
      }
      await delay(RETRY_DELAYS_MS[attempt]);
    }
  }
  throw lastError;
};

const buildCacheKey = (docId: string, projectId?: string) =>
  projectId ? `${projectId}:${docId}` : docId;

export const getPreviewCredentials = async (
  docId: string,
  projectId?: string
): Promise<PreviewCredentialsResponse> => {
  const cacheKey = buildCacheKey(docId, projectId);
  const cached = credentialCache.get(cacheKey);
  if (cached?.credentials && !shouldRefresh(cached.expiresAt)) {
    return cached.credentials;
  }
  if (cached?.refreshPromise) {
    return cached.refreshPromise;
  }

  const refreshPromise = withRetry(async () => {
    const credentials = await resourceApi.getPreviewCredentials(docId, projectId);
    const expiresAt = parseExpiration(credentials.expiration);
    credentialCache.set(cacheKey, { credentials, expiresAt });
    return credentials;
  });

  credentialCache.set(cacheKey, {
    credentials: cached?.credentials,
    expiresAt: cached?.expiresAt,
    refreshPromise,
  });

  try {
    return await refreshPromise;
  } finally {
    const latest = credentialCache.get(cacheKey);
    if (latest?.refreshPromise === refreshPromise) {
      if (latest.credentials && latest.expiresAt) {
        credentialCache.set(cacheKey, { credentials: latest.credentials, expiresAt: latest.expiresAt });
      } else {
        credentialCache.delete(cacheKey);
      }
    }
  }
};
