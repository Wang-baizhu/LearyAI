// docNames 负责提供按 projectId + kbId 作用域读取文档名映射的统一入口。
import { useMemo } from 'react';
import { useAppSelector } from '@/app/store/hooks';
import type { RootState } from '@/app/store';
import { useResourceScope } from '../resourceScope';
import { buildReferenceScopeKey, type ReferenceScopeContext } from '../store/slice';

const EMPTY_DOC_NAME_MAP: Record<string, string> = {};

export const selectScopedDocNameMap = (
  state: RootState,
  context?: ReferenceScopeContext
) => {
  const scopeKey = buildReferenceScopeKey(context);
  if (!scopeKey) {
    return EMPTY_DOC_NAME_MAP;
  }
  return state.resourceCenter.docNameMapByScope?.[scopeKey] ?? EMPTY_DOC_NAME_MAP;
};

export const useScopedDocNameMap = (context?: ReferenceScopeContext) => {
  const scope = useResourceScope();
  const resolvedContext = useMemo(
    () => ({
      projectId: context?.projectId ?? scope.projectId,
      kbId: context?.kbId ?? scope.kbId,
    }),
    [context?.kbId, context?.projectId, scope.kbId, scope.projectId]
  );

  return useAppSelector((state) => selectScopedDocNameMap(state, resolvedContext));
};

export const useDocName = (docId?: string, context?: ReferenceScopeContext) => {
  const docNameMap = useScopedDocNameMap(context);
  const normalizedDocId = String(docId ?? '').trim();
  return normalizedDocId ? docNameMap[normalizedDocId] ?? '' : '';
};
