// detailTabsReducer 负责资源中心详情标签分组的纯状态迁移计算。

export type DetailParentMap<TKey extends string> = Partial<Record<TKey, TKey>>;
export type GroupActiveMemberMap<TKey extends string> = Partial<Record<TKey, TKey>>;

interface DetailTabLike<TKey extends string> {
  key: TKey;
}

export const resolveDetailRootKey = <TKey extends string>(
  key: TKey,
  mergedParentMap: DetailParentMap<TKey>
): TKey => {
  let current = key;
  const visited = new Set<TKey>();
  while (mergedParentMap[current] && !visited.has(current)) {
    visited.add(current);
    current = mergedParentMap[current] as TKey;
  }
  return current;
};

const collectGroupMembers = <TKey extends string, TTab extends DetailTabLike<TKey>>(
  detailTabs: TTab[],
  mergedParentMap: DetailParentMap<TKey>,
  root: TKey
): TKey[] =>
  detailTabs
    .map((item) => item.key)
    .filter((itemKey) => resolveDetailRootKey(itemKey, mergedParentMap) === root);

export const reduceMergeDetailTabs = <TKey extends string, TTab extends DetailTabLike<TKey>>(params: {
  detailTabs: TTab[];
  mergedParentMap: DetailParentMap<TKey>;
  groupActiveMemberMap: GroupActiveMemberMap<TKey>;
  sourceKey: TKey;
  targetKey: TKey;
  activeDetailKey: TKey | null;
}) => {
  const {
    detailTabs,
    mergedParentMap,
    groupActiveMemberMap,
    sourceKey,
    targetKey,
    activeDetailKey,
  } = params;
  const sourceRoot = resolveDetailRootKey(sourceKey, mergedParentMap);
  const targetRoot = resolveDetailRootKey(targetKey, mergedParentMap);
  if (sourceRoot === targetRoot) {
    return {
      changed: false,
      mergedParentMap,
      groupActiveMemberMap,
      nextActiveDetailKey: null as TKey | null,
    };
  }

  const sourceGroupMembers = collectGroupMembers(detailTabs, mergedParentMap, sourceRoot);
  if (!sourceGroupMembers.includes(sourceRoot)) {
    sourceGroupMembers.push(sourceRoot);
  }

  const nextMergedParentMap: DetailParentMap<TKey> = { ...mergedParentMap };
  sourceGroupMembers.forEach((memberKey) => {
    if (memberKey !== targetRoot) {
      nextMergedParentMap[memberKey] = targetRoot;
    }
  });

  const targetActive = groupActiveMemberMap[targetRoot];
  const sourceActive = groupActiveMemberMap[sourceRoot];
  const nextActive =
    sourceKey === activeDetailKey
      ? sourceKey
      : targetKey === activeDetailKey
        ? targetKey
        : sourceActive ?? targetActive ?? targetRoot;
  const nextGroupActiveMemberMap: GroupActiveMemberMap<TKey> = {
    ...groupActiveMemberMap,
    [targetRoot]: nextActive,
  };
  delete nextGroupActiveMemberMap[sourceRoot];

  const nextActiveDetailKey =
    activeDetailKey && resolveDetailRootKey(activeDetailKey, mergedParentMap) === sourceRoot
      ? sourceKey
      : null;

  return {
    changed: true,
    mergedParentMap: nextMergedParentMap,
    groupActiveMemberMap: nextGroupActiveMemberMap,
    nextActiveDetailKey,
  };
};

export const reduceDetachDetailTab = <TKey extends string, TTab extends DetailTabLike<TKey>>(params: {
  key: TKey;
  detailTabs: TTab[];
  mergedParentMap: DetailParentMap<TKey>;
  groupActiveMemberMap: GroupActiveMemberMap<TKey>;
}) => {
  const { key, detailTabs, mergedParentMap, groupActiveMemberMap } = params;
  const root = resolveDetailRootKey(key, mergedParentMap);
  const groupMembers = collectGroupMembers(detailTabs, mergedParentMap, root);
  if (groupMembers.length <= 1) {
    return {
      changed: false,
      mergedParentMap,
      groupActiveMemberMap,
      nextActiveDetailKey: key,
    };
  }

  if (root !== key) {
    const nextMergedParentMap: DetailParentMap<TKey> = { ...mergedParentMap };
    delete nextMergedParentMap[key];
    const nextGroupActiveMemberMap: GroupActiveMemberMap<TKey> =
      groupActiveMemberMap[root] === key
        ? { ...groupActiveMemberMap, [root]: root }
        : groupActiveMemberMap;
    return {
      changed: true,
      mergedParentMap: nextMergedParentMap,
      groupActiveMemberMap: nextGroupActiveMemberMap,
      nextActiveDetailKey: key,
    };
  }

  const nextRoot = groupMembers.find((itemKey) => itemKey !== key) ?? key;
  const nextMergedParentMap: DetailParentMap<TKey> = {};
  (Object.entries(mergedParentMap) as Array<[string, TKey | undefined]>).forEach(([child, parent]) => {
    const childKey = child as TKey;
    if (!parent) return;
    if (parent === key) {
      if (childKey !== nextRoot) {
        nextMergedParentMap[childKey] = nextRoot;
      }
      return;
    }
    nextMergedParentMap[childKey] = parent;
  });

  const nextGroupActiveMemberMap: GroupActiveMemberMap<TKey> = { ...groupActiveMemberMap };
  const rootActive = nextGroupActiveMemberMap[root];
  delete nextGroupActiveMemberMap[root];
  nextGroupActiveMemberMap[nextRoot] =
    rootActive && rootActive !== key && groupMembers.includes(rootActive) ? rootActive : nextRoot;

  return {
    changed: true,
    mergedParentMap: nextMergedParentMap,
    groupActiveMemberMap: nextGroupActiveMemberMap,
    nextActiveDetailKey: key,
  };
};

export const reduceCloseDetailTabGroup = <TKey extends string, TTab extends DetailTabLike<TKey>>(params: {
  key: TKey;
  detailTabs: TTab[];
  mergedParentMap: DetailParentMap<TKey>;
  groupActiveMemberMap: GroupActiveMemberMap<TKey>;
}) => {
  const { key, detailTabs, mergedParentMap, groupActiveMemberMap } = params;
  const closeRoot = resolveDetailRootKey(key, mergedParentMap);
  const membersToClose = new Set(
    detailTabs
      .map((item) => item.key)
      .filter((itemKey) => resolveDetailRootKey(itemKey, mergedParentMap) === closeRoot)
  );

  const nextDetailTabs = detailTabs.filter((item) => !membersToClose.has(item.key));
  const nextMergedParentMap: DetailParentMap<TKey> = {};
  (Object.entries(mergedParentMap) as Array<[string, TKey | undefined]>).forEach(([child, parent]) => {
    const childKey = child as TKey;
    if (membersToClose.has(childKey)) return;
    if (parent && !membersToClose.has(parent)) {
      nextMergedParentMap[childKey] = parent;
    }
  });

  const nextGroupActiveMemberMap: GroupActiveMemberMap<TKey> = { ...groupActiveMemberMap };
  membersToClose.forEach((memberKey) => {
    delete nextGroupActiveMemberMap[memberKey];
  });
  Object.keys(nextGroupActiveMemberMap).forEach((rootKey) => {
    if (membersToClose.has(rootKey as TKey)) {
      delete nextGroupActiveMemberMap[rootKey as TKey];
    }
  });

  return {
    closeRoot,
    membersToClose,
    detailTabs: nextDetailTabs,
    mergedParentMap: nextMergedParentMap,
    groupActiveMemberMap: nextGroupActiveMemberMap,
  };
};
