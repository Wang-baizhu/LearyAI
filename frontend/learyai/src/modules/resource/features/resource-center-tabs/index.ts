// modules/resource/features/resource-center-tabs 对外统一出口，收敛 slice 间依赖路径。
export { reduceCloseDetailTabGroup, reduceDetachDetailTab, reduceMergeDetailTabs, resolveDetailRootKey } from './lib/detailTabsReducer';
export type { DetailParentMap, GroupActiveMemberMap } from './lib/detailTabsReducer';
export { default as useDetailTabs } from './model/useDetailTabs';
export { buildDetailTabKey } from './model/useDetailTabs';
export { default as useDetailTabsDnd } from './model/useDetailTabsDnd';

