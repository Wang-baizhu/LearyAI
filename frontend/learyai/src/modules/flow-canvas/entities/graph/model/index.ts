/** 责任：汇总导出白板图模型的公开类型、状态容器与布局能力。 */
export type {
  AppEdge,
  AppEdgeData,
  AppNode,
  AppNodeData,
  GraphSnapshot,
  GraphState,
  LayoutNodeRole,
  LayoutRelationScope,
} from './types';
export type { GraphStoreApi } from './store';
export { createGraphStore } from './store';
export {
  estimateEdgeLabelLayout,
  getNodeZIndex,
  hasClusterLayoutHints,
  optimizeGraphLayout,
  resolveClusterLayoutPositions,
  resolveEdgeHandlesForLayout,
  resolveFollowLayoutPositions,
  resolveTagAwareLayoutPositions,
  splitNodesForLayout,
} from './effects';
