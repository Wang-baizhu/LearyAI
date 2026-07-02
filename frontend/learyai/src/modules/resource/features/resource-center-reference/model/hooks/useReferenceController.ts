// useReferenceController 负责资源引用状态、本地引用同步与引用跳转。
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { AppDispatch } from '@/app/store';
import { enqueueToast } from '@/app/store/ui/toastSlice';
import {
  clearCitationJump,
  clearReferences,
  setReferencedResources,
  toggleReference,
  type ReferenceResource,
} from '../../../../entities/resource-center';
import type { ResourceListItem, SidebarResource } from '@/modules/kbdoc';
import {
  mapListItemToReference,
  mapListItemToSidebarResource,
  mapReferenceToSidebarResource,
} from '../../../../entities/resource-center';
import {
  clearStoredReferenceState,
  openResourceCenterResourceDetail,
  resolveDocReferenceState,
  setStoredReferenceState,
} from '../../../../entities/resource-center';
import { resolveReferenceTarget } from '../../../../adapter/reference-source/lib/resolveReferenceTarget';
import type { ReferenceSourceItem } from '../../../../adapter/reference-source/model/types';
import useReferenceSync from './useReferenceSync';
import type {
  ResourceCenterDetailOpenHandler,
} from '../../../../entities/resource-center';
import { isDetailTabKey } from '../../../../entities/resource-center';
import type { ResourceOptionItem } from '@/modules/kbdoc';

interface UseReferenceControllerParams {
  dispatch: AppDispatch;
  projectId?: string;
  kbId?: string;
  docId?: string;
  referencedResources: ReferenceResource[];
  syncItems: ResourceListItem[];
  referenceSourceItems: ReferenceSourceItem[];
  docOptions: ResourceOptionItem[];
  isReferenceSourceReady: boolean;
  citationJump: {
    source: string;
    pageText: string;
    token: number;
    sourceDetailTabKey?: string;
  } | null;
  onOpenDetailTab: ResourceCenterDetailOpenHandler;
}

const useReferenceController = ({
  dispatch,
  projectId,
  kbId,
  docId,
  referencedResources,
  syncItems,
  referenceSourceItems,
  docOptions,
  isReferenceSourceReady,
  citationJump,
  onOpenDetailTab,
}: UseReferenceControllerParams) => {
  const listItemsRef = useRef<ReferenceSourceItem[]>(referenceSourceItems);
  const referencedRef = useRef(referencedResources);
  const docOptionsRef = useRef(docOptions);

  const resolvedReferenceSourceItems = useMemo(() => referenceSourceItems, [referenceSourceItems]);
  const referencedDocRefs = useMemo(
    () => referencedResources.map((item) => ({ id: item.docId, name: item.name })),
    [referencedResources]
  );
  const fallbackDocRef = useMemo(() => {
    if (!docId) return null;
    const match = resolvedReferenceSourceItems.find((item) => item.docId === docId);
    if (!match) return null;
    return { id: match.docId, name: match.name };
  }, [docId, resolvedReferenceSourceItems]);

  useEffect(() => {
    listItemsRef.current = referenceSourceItems;
  }, [referenceSourceItems]);

  useEffect(() => {
    referencedRef.current = referencedResources;
  }, [referencedResources]);

  useEffect(() => {
    docOptionsRef.current = docOptions;
  }, [docOptions]);

  useReferenceSync({
    listItems: syncItems,
    referencedRef,
    dispatch,
    projectId,
    kbId,
  });

  const sidebarResources = useMemo(() => {
    const listItemMap = new Map(resolvedReferenceSourceItems.map((item) => [item.docId, item]));
    const optionDocIdSet = new Set(docOptions.map((item) => item.docId));
    const resources = docOptions.map<SidebarResource>((item) => {
      const matchedListItem = listItemMap.get(item.docId);
      if (matchedListItem) {
        return mapListItemToSidebarResource({
          ...matchedListItem,
          name: item.name,
          status: item.status,
        });
      }
      return {
        ...mapReferenceToSidebarResource({
          id: item.docId,
          docId: item.docId,
          name: item.name,
          fileType: 'other',
          previewUrl: null,
        }),
        status: item.status,
      };
    });

    resolvedReferenceSourceItems.forEach((item) => {
      if (optionDocIdSet.has(item.docId)) {
        return;
      }
      resources.push(mapListItemToSidebarResource(item));
    });

    return resources;
  }, [docOptions, resolvedReferenceSourceItems]);
  const sidebarReferenced = useMemo(
    () => referencedResources.map(mapReferenceToSidebarResource),
    [referencedResources]
  );

  useEffect(() => {
    if (!citationJump) return;
    if (!isReferenceSourceReady) return;

    let cancelled = false;

    const resolveAndNavigate = async () => {
      try {
        const firstPage = Number(citationJump.pageText.split('-')[0]?.trim());
        if (!Number.isFinite(firstPage) || firstPage < 1) return;

        const source = citationJump.source;
        let target = null;
        try {
          target = await resolveReferenceTarget({
            source,
            referencedResources: referencedRef.current,
            listItems: listItemsRef.current,
          });
        } catch (error) {
          console.error('引用资源加载失败', error);
        }

        const matchedOption = docOptionsRef.current.find((item) => item.docId === source);
        if (!target || cancelled) {
          if (matchedOption && kbId && projectId) {
            const mergeTargetKey =
              citationJump.sourceDetailTabKey && isDetailTabKey(citationJump.sourceDetailTabKey)
                ? citationJump.sourceDetailTabKey
                : undefined;
            openResourceCenterResourceDetail(onOpenDetailTab, {
              docId: matchedOption.docId,
              label: matchedOption.name,
              jumpToPage: firstPage,
              jumpToken: citationJump.token,
              autoMergeToActiveGroup: true,
              mergeTargetKey,
            });
            return;
          }
          dispatch(
            enqueueToast({
              variant: 'error',
              message: '引用资源可能已删除',
            })
          );
          return;
        }
        if (!kbId || !projectId) return;

        const jumpableTypes = new Set([
          'pdf',
          'pptx',
          'docx',
          'md',
          'txt',
          'url',
          'wav',
          'mp3',
          'm4a',
          'aac',
          'flac',
          'ogg',
        ]);
        const mergeTargetKey =
          citationJump.sourceDetailTabKey && isDetailTabKey(citationJump.sourceDetailTabKey)
            ? citationJump.sourceDetailTabKey
            : undefined;
        openResourceCenterResourceDetail(onOpenDetailTab, {
          docId: target.docId,
          label: target.name,
          jumpToPage: jumpableTypes.has(target.fileType) ? firstPage : undefined,
          jumpToken: jumpableTypes.has(target.fileType) ? citationJump.token : undefined,
          autoMergeToActiveGroup: true,
          mergeTargetKey,
        });
      } finally {
        if (!cancelled) {
          dispatch(clearCitationJump());
        }
      }
    };

    void resolveAndNavigate();

    return () => {
      cancelled = true;
      dispatch(clearCitationJump());
    };
  }, [citationJump, dispatch, isReferenceSourceReady, kbId, onOpenDetailTab, projectId]);

  const handleToggleReference = useCallback(
    (resource: SidebarResource) => {
      if (!projectId || !kbId) return;
      const isReferenced = referencedResources.some((item) => item.docId === resource.id);
      const nextIsReference = !isReferenced;
      setStoredReferenceState(
        { projectId, kbId, docId: resource.id },
        nextIsReference
      );
      dispatch(
        toggleReference({
          context: { projectId, kbId },
          reference: {
            id: resource.id,
            docId: resource.id,
            name: resource.title,
            fileType: resource.file?.kind ?? 'other',
            previewUrl: resource.file?.url ?? null,
          },
          nextIsReference,
        })
      );
    },
    [dispatch, kbId, projectId, referencedResources]
  );

  const handleListToggleReference = useCallback(
    (item: ResourceListItem) => {
      if (!projectId || !kbId) return;
      const nextIsReference = !resolveDocReferenceState({
        projectId,
        kbId,
        docId: item.docId,
        status: item.status,
      });
      setStoredReferenceState(
        { projectId, kbId, docId: item.docId },
        nextIsReference
      );
      dispatch(
        toggleReference({
          context: { projectId, kbId },
          reference: mapListItemToReference(item),
          nextIsReference,
        })
      );
    },
    [dispatch, kbId, projectId]
  );

  const handleClearReferences = useCallback(() => {
    if (projectId && kbId) {
      referencedResources.forEach((reference) => {
        setStoredReferenceState(
          { projectId, kbId, docId: reference.docId },
          false
        );
      });
    }
    dispatch(clearReferences({ projectId, kbId }));
  }, [dispatch, kbId, projectId, referencedResources]);

  const handleResourceDeleted = useCallback(
    (deletedDocId: string) => {
      if (projectId && kbId) {
        clearStoredReferenceState({ projectId, kbId, docId: deletedDocId });
      }
      dispatch(
        setReferencedResources(
          {
            context: { projectId, kbId },
            resources: referencedResources.filter((item) => item.docId !== deletedDocId),
          }
        )
      );
    },
    [dispatch, kbId, projectId, referencedResources]
  );

  return {
    referenceSourceItems: resolvedReferenceSourceItems,
    sidebarResources,
    sidebarReferenced,
    referencedDocRefs,
    fallbackDocRef,
    handleToggleReference,
    handleListToggleReference,
    handleClearReferences,
    handleResourceDeleted,
  };
};

export default useReferenceController;
