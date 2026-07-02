// resolveReferenceTarget 负责从已引用列表、列表结果或 kbdoc 补查中解析资源中心引用目标。
import {
  findReferenceBySource,
  mapListItemToReference,
  type ReferenceResource,
} from '../../../entities/resource-center';
import type { ReferenceSourceItem, ReferenceSourceTarget } from '../model/types';

interface ResolveReferenceTargetParams {
  source: string;
  referencedResources: ReferenceResource[];
  listItems: ReferenceSourceItem[];
}

export const resolveReferenceTarget = async ({
  source,
  referencedResources,
  listItems,
}: ResolveReferenceTargetParams): Promise<ReferenceSourceTarget | null> => {
  const foundInState = findReferenceBySource(source, referencedResources);
  if (foundInState) {
    return foundInState;
  }

  const foundInList = findReferenceBySource(
    source,
    listItems.map(mapListItemToReference)
  );
  if (foundInList) {
    return foundInList;
  }

  return null;
};
