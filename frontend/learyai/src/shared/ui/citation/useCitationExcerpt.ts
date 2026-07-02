// useCitationExcerpt 负责按 docId 与页码懒加载引用原文片段。
import { useEffect, useState } from 'react';
import { apiRequest } from '@/shared/api/client';
import type { ApiEnvelope, ApiQuery, ApiRes } from '@/shared/api/contract';
import { normalizeCitationPageValue } from '@/shared/lib/citation';

interface TextChunkItem {
  chunkSec: number;
  text: string;
}

interface TextChunkPage {
  items: TextChunkItem[];
}

type TextChunkPageApiResponse = ApiRes<'/api/kb/docs/{docId}/text-chunks', 'get'>;

const excerptCache = new Map<string, string>();
const pendingRequestCache = new Map<string, Promise<string>>();

const unwrapResponse = <T>(response: Pick<Partial<ApiEnvelope<T>>, 'data'>) => response.data;
const normalizeExcerpt = (value: string) => value.replace(/\s+/g, ' ').trim();
const parseCitationExcerptPage = (page: string) => {
  const normalizedPage = normalizeCitationPageValue(page);
  const firstPage = normalizedPage.split('-')[0]?.trim() ?? '';
  return Number.parseInt(firstPage, 10);
};

const fetchCitationExcerpt = async (projectId: string, docId: string, page: string) => {
  const pageValue = parseCitationExcerptPage(page);
  if (!projectId.trim() || !docId.trim() || Number.isNaN(pageValue) || pageValue <= 0) {
    return '';
  }

  const cacheKey = `${projectId}::${docId}::${pageValue}`;
  if (excerptCache.has(cacheKey)) {
    return excerptCache.get(cacheKey) ?? '';
  }

  const pendingRequest = pendingRequestCache.get(cacheKey);
  if (pendingRequest) {
    return pendingRequest;
  }

  const request = apiRequest<TextChunkPageApiResponse>(`/kb/docs/${docId}/text-chunks`, {
    params: {
      projectId,
      startChunkSec: pageValue,
      size: 1,
    } satisfies Partial<ApiQuery<'/api/kb/docs/{docId}/text-chunks', 'get'>>,
  })
    .then((response) => {
      const data = unwrapResponse(response) as TextChunkPage | undefined;
      const matchedItem = data?.items.find((item) => Number(item.chunkSec) === pageValue);
      const excerpt = normalizeExcerpt(matchedItem?.text ?? '');
      excerptCache.set(cacheKey, excerpt);
      return excerpt;
    })
    .finally(() => {
      pendingRequestCache.delete(cacheKey);
    });

  pendingRequestCache.set(cacheKey, request);
  return request;
};

export const useCitationExcerpt = (projectId: string, docId: string, page: string) => {
  const [excerpt, setExcerpt] = useState('');

  useEffect(() => {
    const safeProjectId = String(projectId ?? '').trim();
    const safeDocId = String(docId ?? '').trim();
    const safePage = String(page ?? '').trim();
    if (!safeProjectId || !safeDocId || !safePage) return;

    let cancelled = false;
    fetchCitationExcerpt(safeProjectId, safeDocId, safePage)
      .then((nextExcerpt) => {
        if (!cancelled) {
          setExcerpt(nextExcerpt);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setExcerpt('');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [docId, page, projectId]);

  return excerpt;
};
