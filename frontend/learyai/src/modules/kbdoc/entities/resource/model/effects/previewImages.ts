// previewImages 负责基于统一存储适配层拉取文档预览图片。
import { getPreviewCredentials } from './previewCredentials';
import { buildObjectKey, isOssProvider } from './previewObjectReader';
import { createAwsPreviewReader } from './previewObjectReaderAws';
import { createOssPreviewReader } from './previewObjectReaderOss';

export interface PreviewImagePage {
  urls: string[];
  nextIndex: number;
  hasMore: boolean;
}

type PreviewCacheEntry = {
  size: number;
  ts: number;
  docId?: string;
  projectId?: string;
};

type PreviewCacheIndex = {
  totalSize: number;
  entries: Record<string, PreviewCacheEntry>;
};

const PREVIEW_CACHE_NAME = 'kbdoc-preview-images-v1';
const PREVIEW_CACHE_INDEX_KEY = 'kbdoc-preview-images-index-v1';
const PREVIEW_CACHE_MAX_BYTES = 300 * 1024 * 1024;

const canUsePreviewCache = () =>
  typeof window !== 'undefined' &&
  typeof window.caches !== 'undefined' &&
  typeof window.localStorage !== 'undefined' &&
  typeof window.location !== 'undefined';

const buildPreviewCacheRequest = (cacheKey: string) =>
  new Request(
    `${window.location.origin}/kbdoc-preview/${encodeURIComponent(cacheKey)}`
  );

const loadPreviewCacheIndex = (): PreviewCacheIndex => {
  if (!canUsePreviewCache()) {
    return { totalSize: 0, entries: {} };
  }
  try {
    const raw = window.localStorage.getItem(PREVIEW_CACHE_INDEX_KEY);
    if (!raw) {
      return { totalSize: 0, entries: {} };
    }
    const parsed = JSON.parse(raw) as PreviewCacheIndex;
    if (!parsed || typeof parsed.totalSize !== 'number' || !parsed.entries) {
      return { totalSize: 0, entries: {} };
    }
    return parsed;
  } catch {
    return { totalSize: 0, entries: {} };
  }
};

const savePreviewCacheIndex = (index: PreviewCacheIndex) => {
  if (!canUsePreviewCache()) return;
  try {
    window.localStorage.setItem(
      PREVIEW_CACHE_INDEX_KEY,
      JSON.stringify(index)
    );
  } catch {
    // Ignore storage errors to avoid blocking preview rendering.
  }
};

const updatePreviewCacheEntry = (
  index: PreviewCacheIndex,
  cacheKey: string,
  size: number,
  docId?: string,
  projectId?: string
) => {
  const existing = index.entries[cacheKey];
  if (existing) {
    index.totalSize -= existing.size;
  }
  index.entries[cacheKey] = {
    size,
    ts: Date.now(),
    docId,
    projectId,
  };
  index.totalSize += size;
};

const removePreviewCacheEntry = async (
  cache: Cache,
  index: PreviewCacheIndex,
  cacheKey: string
) => {
  const entry = index.entries[cacheKey];
  if (!entry) return;
  try {
    await cache.delete(buildPreviewCacheRequest(cacheKey));
  } catch {
    // Ignore cache delete errors.
  }
  index.totalSize -= entry.size;
  delete index.entries[cacheKey];
};

const enforcePreviewCacheLimit = async (
  cache: Cache,
  index: PreviewCacheIndex
) => {
  if (index.totalSize <= PREVIEW_CACHE_MAX_BYTES) return;
  const entries = Object.entries(index.entries);
  entries.sort(([, a], [, b]) => a.ts - b.ts);
  for (const [cacheKey] of entries) {
    if (index.totalSize <= PREVIEW_CACHE_MAX_BYTES) break;
    await removePreviewCacheEntry(cache, index, cacheKey);
  }
};

export const clearPreviewImageCacheForDoc = async (
  docId: string,
  projectId?: string
) => {
  if (!canUsePreviewCache()) return;
  const cache = await window.caches.open(PREVIEW_CACHE_NAME);
  const index = loadPreviewCacheIndex();
  const entries = Object.entries(index.entries);
  for (const [cacheKey, entry] of entries) {
    if (entry.docId !== docId) continue;
    if (projectId && entry.projectId !== projectId) continue;
    await removePreviewCacheEntry(cache, index, cacheKey);
  }
  savePreviewCacheIndex(index);
};

export const fetchPreviewImagesPage = async (
  docId: string,
  startIndex: number,
  pageSize: number,
  projectId?: string
): Promise<PreviewImagePage> => {
  const credentials = await getPreviewCredentials(docId, projectId);
  const reader = isOssProvider(credentials)
    ? createOssPreviewReader(credentials)
    : createAwsPreviewReader(credentials);
  const cache = canUsePreviewCache()
    ? await window.caches.open(PREVIEW_CACHE_NAME)
    : null;
  const cacheIndex = loadPreviewCacheIndex();
  const urls: string[] = [];
  let hasMore = true;
  let index = startIndex;
  const endIndex = startIndex + pageSize - 1;

  for (; index <= endIndex; index += 1) {
    const key = buildObjectKey(credentials.prefix, docId, index);
    const cacheKey = `${credentials.bucket}/${key}`;
    try {
      if (cache) {
        const cachedResponse = await cache.match(
          buildPreviewCacheRequest(cacheKey)
        );
        if (cachedResponse) {
          const cachedBlob = await cachedResponse.blob();
          urls.push(URL.createObjectURL(cachedBlob));
          updatePreviewCacheEntry(
            cacheIndex,
            cacheKey,
            cachedBlob.size,
            docId,
            projectId
          );
          continue;
        }
      }
      const blob = await reader.fetchObjectAsBlob(credentials.bucket, key);
      if (cache) {
        try {
          await cache.put(buildPreviewCacheRequest(cacheKey), new Response(blob));
        } catch {
          // Ignore cache put errors.
        }
        updatePreviewCacheEntry(
          cacheIndex,
          cacheKey,
          blob.size,
          docId,
          projectId
        );
        await enforcePreviewCacheLimit(cache, cacheIndex);
      }
      const url = URL.createObjectURL(blob);
      urls.push(url);
    } catch (error) {
      if (reader.isNotFoundError(error)) {
        hasMore = false;
        break;
      }
      urls.forEach((url) => URL.revokeObjectURL(url));
      throw error;
    }
  }

  if (cache) {
    savePreviewCacheIndex(cacheIndex);
  }

  return {
    urls,
    nextIndex: index,
    hasMore,
  };
};
