/** 责任：根据标签筛选规则派生白板当前可见节点与边。 */
import type { Edge } from '@xyflow/react';

import type { AppNode } from '../../../entities/graph';

export const resolveVisibleNodes = (nodes: AppNode[], selectedTags: string[]) => {
  if (selectedTags.length === 0) {
    return nodes;
  }

  return nodes.filter((node) =>
    node.type === 'annotation' || node.data.tags?.some((tag) => selectedTags.includes(tag))
  );
};

export const resolveVisibleEdges = (edges: Edge[], visibleNodes: AppNode[]) => {
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
  return edges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target));
};
