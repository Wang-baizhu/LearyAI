/** 责任：维护白板自动布局后的标签分组位置压缩逻辑。 */
import {
  LAYOUT_COLUMN_X_TOLERANCE,
  TAG_GROUP_INNER_GAP,
  TAG_GROUP_OUTER_GAP,
} from './constants';
import type { LayoutNodeDraft, LayoutPoint } from './layoutTypes';
import type { AppNode } from '../types';

const getPrimaryLayoutTag = (node: AppNode) => {
  const primaryTag = node.data.tags?.[0]?.trim();
  return primaryTag && primaryTag.length > 0 ? primaryTag : '未分类';
};

const groupLayoutNodesByTag = (layoutNodes: LayoutNodeDraft[]) => {
  const orderedNodes = [...layoutNodes].sort((firstNode, secondNode) => {
    const deltaY = firstNode.position.y - secondNode.position.y;
    return deltaY !== 0 ? deltaY : firstNode.position.x - secondNode.position.x;
  });
  const groups = new Map<string, LayoutNodeDraft[]>();

  orderedNodes.forEach((layoutNode) => {
    const tag = getPrimaryLayoutTag(layoutNode.node);
    groups.set(tag, [...(groups.get(tag) ?? []), layoutNode]);
  });

  return Array.from(groups.values());
};

const groupLayoutNodesByColumn = (layoutNodes: LayoutNodeDraft[]) => {
  const sortedNodes = [...layoutNodes].sort((firstNode, secondNode) => {
    const deltaX = firstNode.position.x - secondNode.position.x;
    return deltaX !== 0 ? deltaX : firstNode.position.y - secondNode.position.y;
  });
  const columns: LayoutNodeDraft[][] = [];

  sortedNodes.forEach((layoutNode) => {
    const currentColumn = columns[columns.length - 1];
    const firstColumnNode = currentColumn?.[0];

    if (!currentColumn || !firstColumnNode) {
      columns.push([layoutNode]);
      return;
    }

    if (Math.abs(layoutNode.position.x - firstColumnNode.position.x) > LAYOUT_COLUMN_X_TOLERANCE) {
      columns.push([layoutNode]);
      return;
    }

    currentColumn.push(layoutNode);
  });

  return columns;
};

const getLayoutNodeGap = (
  previousNode: LayoutNodeDraft,
  currentNode: LayoutNodeDraft
) => currentNode.position.y - (previousNode.position.y + previousNode.height);

const clampRetainedGap = (gap: number, minimumGap: number) =>
  Math.max(minimumGap, Math.min(gap, minimumGap + 48));

export const resolveTagAwareLayoutPositions = (layoutNodes: LayoutNodeDraft[]) => {
  const nodePositions = new Map<string, LayoutPoint>();

  groupLayoutNodesByColumn(layoutNodes).forEach((column) => {
    const tagGroups = groupLayoutNodesByTag(column);
    let nextY = Math.min(...column.map((layoutNode) => layoutNode.position.y));
    let previousGroupLastNode: LayoutNodeDraft | null = null;

    tagGroups.forEach((group, groupIndex) => {
      if (group.length === 0) {
        return;
      }

      const firstGroupNode = group[0];
      if (groupIndex > 0 && previousGroupLastNode && firstGroupNode) {
        nextY += clampRetainedGap(
          getLayoutNodeGap(previousGroupLastNode, firstGroupNode),
          TAG_GROUP_OUTER_GAP
        );
      }

      let previousNodeInGroup: LayoutNodeDraft | null = null;
      group.forEach((layoutNode, nodeIndex) => {
        if (nodeIndex === 0) {
          nodePositions.set(layoutNode.node.id, {
            x: layoutNode.position.x,
            y: nextY,
          });
          nextY += layoutNode.height;
          previousNodeInGroup = layoutNode;
          return;
        }

        nextY += Math.max(
          TAG_GROUP_INNER_GAP,
          clampRetainedGap(
            getLayoutNodeGap(previousNodeInGroup!, layoutNode),
            TAG_GROUP_INNER_GAP
          )
        );
        nodePositions.set(layoutNode.node.id, {
          x: layoutNode.position.x,
          y: nextY,
        });
        nextY += layoutNode.height;
        previousNodeInGroup = layoutNode;
      });

      previousGroupLastNode = group[group.length - 1];
    });
  });

  return nodePositions;
};
