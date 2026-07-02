/** 责任：维护白板节点层级、来源与复制规则。 */
import { DUPLICATE_NODE_OFFSET } from './constants';
import type { AppNode } from '../types';

export const getNodeZIndex = (node: Pick<AppNode, 'type' | 'selected'>) =>
  node.type === 'annotation' ? (node.selected ? 10 : -1) : 1;

export const getNodeSourceId = (node: AppNode) => node.data.sourceNodeId ?? node.id;

const createDuplicatedNodeId = (nodeId: string, existingNodeIds: Set<string>) => {
  let index = 1;
  let duplicatedNodeId = `${nodeId}__copy_${Date.now()}_${index}`;

  while (existingNodeIds.has(duplicatedNodeId)) {
    index += 1;
    duplicatedNodeId = `${nodeId}__copy_${Date.now()}_${index}`;
  }

  existingNodeIds.add(duplicatedNodeId);
  return duplicatedNodeId;
};

export const duplicateNode = (
  node: AppNode,
  existingNodeIds: Set<string>,
  duplicateIndex: number
): AppNode => {
  const selectedOffset = DUPLICATE_NODE_OFFSET * (duplicateIndex + 1);
  const nextNode = {
    ...node,
    id: createDuplicatedNodeId(node.id, existingNodeIds),
    selected: true,
    position: {
      x: node.position.x + selectedOffset,
      y: node.position.y + selectedOffset,
    },
    data: {
      ...node.data,
      sourceNodeId: getNodeSourceId(node),
    },
  };

  return {
    ...nextNode,
    zIndex: getNodeZIndex(nextNode),
  };
};
