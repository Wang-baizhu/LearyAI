// useReferenceSync 负责根据本地存储的引用状态同步引用资源集合。
import { useEffect } from 'react';
import type { AppDispatch } from '@/app/store';
import type { ResourceListItem } from '@/modules/kbdoc';
import {
  setReferencedResources,
  type ReferenceResource,
} from '../../../../entities/resource-center';
import { mapListItemToReference, resolveDocReferenceState } from '../../../../entities/resource-center';

interface UseReferenceSyncParams {
  listItems: ResourceListItem[];
  referencedRef: React.MutableRefObject<ReferenceResource[]>;
  dispatch: AppDispatch;
  projectId?: string;
  kbId?: string;
}

const useReferenceSync = ({
  listItems,
  referencedRef,
  dispatch,
  projectId,
  kbId,
}: UseReferenceSyncParams) => {
  useEffect(() => {
    if (!projectId || !kbId || !listItems.length) return;

    const nextMap = new Map(referencedRef.current.map((item) => [item.docId, item]));
    const processed = new Set<string>();
    let changed = false;

    listItems.forEach((item) => {
      if (processed.has(item.docId)) return;
      processed.add(item.docId);

      const isReferenced = resolveDocReferenceState({
        projectId,
        kbId,
        docId: item.docId,
        status: item.status,
      });
      if (isReferenced) {
        if (!nextMap.has(item.docId)) {
          nextMap.set(item.docId, mapListItemToReference(item));
          changed = true;
        }
        return;
      }
      if (nextMap.has(item.docId)) {
        nextMap.delete(item.docId);
        changed = true;
      }
    });

    if (changed) {
      dispatch(
        setReferencedResources({
          context: { projectId, kbId },
          resources: Array.from(nextMap.values()),
        })
      );
    }
  }, [dispatch, kbId, listItems, projectId, referencedRef]);
};

export default useReferenceSync;
