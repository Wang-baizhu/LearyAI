// referenceStorage 负责按 projectId + kbId + docId 维护知识库引用的本地状态。
import {
  safeLocalStorageGet,
  safeLocalStorageRemove,
  safeLocalStorageSet,
} from '@/shared/lib/safeLocalStorage';

interface ReferenceStorageKeyParams {
  projectId?: string;
  kbId?: string;
  docId: string;
}

const STORAGE_PREFIX = 'learyai:kbdoc:reference';
const FALSE_VALUE = 'false';

const normalizeSegment = (value?: string) => value?.trim() || '';

const buildStorageKey = ({ projectId, kbId, docId }: ReferenceStorageKeyParams) => {
  const normalizedProjectId = normalizeSegment(projectId);
  const normalizedKbId = normalizeSegment(kbId);
  const normalizedDocId = normalizeSegment(docId);
  if (!normalizedProjectId || !normalizedKbId || !normalizedDocId) return null;
  return `${STORAGE_PREFIX}:${normalizedProjectId}:${normalizedKbId}:${normalizedDocId}`;
};

export const getStoredReferenceState = (params: ReferenceStorageKeyParams) => {
  const key = buildStorageKey(params);
  if (!key) return true;
  return safeLocalStorageGet(key) !== FALSE_VALUE;
};

export const setStoredReferenceState = (
  params: ReferenceStorageKeyParams,
  isReference: boolean
) => {
  const key = buildStorageKey(params);
  if (!key) return false;
  if (isReference) {
    return safeLocalStorageRemove(key);
  }
  return safeLocalStorageSet(key, FALSE_VALUE);
};

export const clearStoredReferenceState = (params: ReferenceStorageKeyParams) => {
  const key = buildStorageKey(params);
  if (!key) return false;
  return safeLocalStorageRemove(key);
};

export const resolveDocReferenceState = (params: ReferenceStorageKeyParams & { status?: string }) => {
  if (params.status !== 'DONE') return false;
  return getStoredReferenceState(params);
};
