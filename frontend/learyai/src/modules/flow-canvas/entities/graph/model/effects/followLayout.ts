/** 责任：维护白板附属节点跟随主节点的自动布局约束。 */
import {
  ANNOTATION_LAYOUT_GAP_X,
  ANNOTATION_LAYOUT_GAP_Y,
} from './constants';
import type { LayoutNodeDraft, LayoutPoint } from './layoutTypes';
import type { AppEdge, AppNode } from '../types';

type FollowSide = 'left' | 'right';

interface FollowLayoutNodeDraft extends LayoutNodeDraft {
  followTo: string;
  side: FollowSide;
  originalCenterY: number;
}

const isAnnotationNode = (node: AppNode) => node.type === 'annotation';

export const splitNodesForLayout = (nodes: AppNode[], edges: AppEdge[]) => {
  void edges;
  const primaryNodes = nodes.filter((node) => !isAnnotationNode(node));

  return {
    primaryNodes,
    followNodes: [],
  };
};

const resolveFollowNodeX = (
  followNode: FollowLayoutNodeDraft,
  anchorLayoutNode: LayoutNodeDraft
) =>
  followNode.side === 'left'
    ? anchorLayoutNode.position.x - followNode.width - ANNOTATION_LAYOUT_GAP_X
    : anchorLayoutNode.position.x + anchorLayoutNode.width + ANNOTATION_LAYOUT_GAP_X;

export const resolveFollowLayoutPositions = (
  primaryLayoutNodes: LayoutNodeDraft[],
  followNodes: FollowLayoutNodeDraft[]
) => {
  const nextPositions = new Map<string, LayoutPoint>();
  const primaryLayoutNodeMap = new Map(primaryLayoutNodes.map((layoutNode) => [layoutNode.node.id, layoutNode]));
  const followGroups = new Map<string, FollowLayoutNodeDraft[]>();

  followNodes.forEach((followNode) => {
    const groupKey = `${followNode.followTo}:${followNode.side}`;
    followGroups.set(groupKey, [...(followGroups.get(groupKey) ?? []), followNode]);
  });

  followGroups.forEach((group) => {
    const anchorLayoutNode = primaryLayoutNodeMap.get(group[0]?.followTo ?? '');

    if (!anchorLayoutNode) {
      return;
    }

    const sortedGroup = [...group].sort((firstNode, secondNode) =>
      firstNode.originalCenterY - secondNode.originalCenterY
    );
    const totalHeight = sortedGroup.reduce(
      (height, layoutNode, index) => height + layoutNode.height + (index > 0 ? ANNOTATION_LAYOUT_GAP_Y : 0),
      0
    );
    let nextY =
      anchorLayoutNode.position.y + anchorLayoutNode.height / 2 - totalHeight / 2;

    sortedGroup.forEach((followNode, index) => {
      if (index > 0) {
        nextY += ANNOTATION_LAYOUT_GAP_Y;
      }

      nextPositions.set(followNode.node.id, {
        x: resolveFollowNodeX(followNode, anchorLayoutNode),
        y: nextY,
      });
      nextY += followNode.height;
    });
  });

  return nextPositions;
};
