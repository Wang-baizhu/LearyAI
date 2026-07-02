/** 责任：基于通用 cluster / anchor / member hint 计算资源聚合布局。 */
import dagre from 'dagre';

import {
  CLUSTER_ANCHOR_MEMBER_GAP_X,
  CLUSTER_LAYOUT_GAP_X,
  CLUSTER_LAYOUT_GAP_Y,
  CLUSTER_LAYOUT_PADDING_X,
  CLUSTER_LAYOUT_PADDING_Y,
  CLUSTER_MEMBER_GAP_Y,
  CLUSTER_NODE_GAP_Y,
  DEFAULT_LAYOUT_NODE_HEIGHT,
  DEFAULT_LAYOUT_NODE_WIDTH,
} from './constants';
import type { LayoutNodeDraft, LayoutPoint } from './layoutTypes';
import type { AppEdge, AppNode } from '../types';

interface GraphClusterLayoutInput {
  nodes: AppNode[];
  edges: AppEdge[];
}

interface ClusterPlacement {
  id: string;
  width: number;
  height: number;
  members: LayoutNodeDraft[];
}

interface MemberColumnPlacement {
  layouts: LayoutNodeDraft[];
  bottomY: number;
  maxRight: number;
}

type CenterMemberZone = 'top' | 'right' | 'bottom';

const getNodeWidth = (node: AppNode) =>
  node.measured?.width ?? node.width ?? DEFAULT_LAYOUT_NODE_WIDTH;

const getNodeHeight = (node: AppNode) =>
  node.measured?.height ?? node.height ?? DEFAULT_LAYOUT_NODE_HEIGHT;

const isClusterNode = (node: AppNode) => node.data.layoutRole === 'cluster';

const isAnchorNode = (node: AppNode) => node.data.layoutRole === 'anchor';

const getClusterId = (node: AppNode) => node.data.layoutClusterId ?? `__node__:${node.id}`;

const getRelationWeight = (edge: AppEdge) => {
  const relationWeight = edge.data?.relationWeight;
  return typeof relationWeight === 'number' && Number.isFinite(relationWeight)
    ? Math.max(1, relationWeight)
    : 1;
};

const sortNodesByLayoutOrder = (nodes: AppNode[]) =>
  [...nodes].sort((firstNode, secondNode) => {
    const firstOrder = firstNode.data.layoutOrder ?? Number.MAX_SAFE_INTEGER;
    const secondOrder = secondNode.data.layoutOrder ?? Number.MAX_SAFE_INTEGER;
    if (firstOrder !== secondOrder) {
      return firstOrder - secondOrder;
    }
    return firstNode.id.localeCompare(secondNode.id);
  });

const CENTER_MEMBER_COLUMN_PRIORITY = ['mindmap', 'quiz'] as const;

const resolveCenterMemberColumnKey = (node: AppNode) => {
  if (node.data.resourceKind === 'template') {
    const pluginId = typeof node.data.pluginId === 'string' ? node.data.pluginId.trim() : '';
    const templateType = typeof node.data.templateType === 'string' ? node.data.templateType.trim() : '';
    return pluginId || templateType || 'template';
  }
  if (node.data.resourceKind === 'kbdoc') {
    return 'kbdoc';
  }
  return node.type === 'annotation' ? 'annotation' : 'custom';
};

const compareCenterMemberColumnKeys = (firstKey: string, secondKey: string) => {
  const firstPriority = CENTER_MEMBER_COLUMN_PRIORITY.indexOf(firstKey as typeof CENTER_MEMBER_COLUMN_PRIORITY[number]);
  const secondPriority = CENTER_MEMBER_COLUMN_PRIORITY.indexOf(secondKey as typeof CENTER_MEMBER_COLUMN_PRIORITY[number]);

  if (firstPriority !== -1 || secondPriority !== -1) {
    if (firstPriority === -1) {
      return 1;
    }
    if (secondPriority === -1) {
      return -1;
    }
    if (firstPriority !== secondPriority) {
      return firstPriority - secondPriority;
    }
  }

  return firstKey.localeCompare(secondKey);
};

const resolveCenterMemberDefaultZone = (
  centerNode: AppNode | undefined,
  memberNode: AppNode
): CenterMemberZone => {
  if (centerNode?.data.resourceKind === 'kbdoc' && memberNode.data.resourceKind === 'template') {
    const pluginId = typeof memberNode.data.pluginId === 'string'
      ? memberNode.data.pluginId.trim()
      : typeof memberNode.data.templateType === 'string'
        ? memberNode.data.templateType.trim()
        : '';

    if (pluginId === 'mindmap') {
      return 'top';
    }

    if (pluginId === 'quiz') {
      return 'right';
    }

    return 'bottom';
  }

  return 'right';
};

const resolveCenterMemberZoneByHandle = (handle: string | null | undefined): CenterMemberZone | null => {
  if (!handle) {
    return null;
  }

  if (handle.startsWith('t-')) {
    return 'top';
  }

  if (handle.startsWith('b-')) {
    return 'bottom';
  }

  if (handle.startsWith('l-') || handle.startsWith('r-')) {
    return 'right';
  }

  return null;
};

const resolveCenterMemberZone = (
  centerNode: AppNode | undefined,
  memberNode: AppNode,
  edges: AppEdge[]
): CenterMemberZone => {
  if (!centerNode) {
    return 'right';
  }

  const connectedCenterEdge = edges.find((edge) => (
    (edge.source === centerNode.id && edge.target === memberNode.id) ||
    (edge.target === centerNode.id && edge.source === memberNode.id)
  ));

  if (!connectedCenterEdge) {
    return resolveCenterMemberDefaultZone(centerNode, memberNode);
  }

  const centerHandle = connectedCenterEdge.source === centerNode.id
    ? connectedCenterEdge.sourceHandle
    : connectedCenterEdge.targetHandle;

  return resolveCenterMemberZoneByHandle(centerHandle)
    ?? resolveCenterMemberDefaultZone(centerNode, memberNode);
};

const placeCenterMemberColumns = (
  nodes: AppNode[],
  centerNode: AppNode | undefined,
  centerNodeHeight: number,
  edges: AppEdge[],
  startX: number,
  startY: number
): MemberColumnPlacement => {
  if (nodes.length === 0) {
    return {
      layouts: [],
      bottomY: startY,
      maxRight: 0,
    };
  }

  const nodesByColumnKey = new Map<string, AppNode[]>();
  nodes.forEach((node) => {
    const columnKey = resolveCenterMemberColumnKey(node);
    nodesByColumnKey.set(columnKey, [...(nodesByColumnKey.get(columnKey) ?? []), node]);
  });

  const orderedColumnKeys = Array.from(nodesByColumnKey.keys()).sort(compareCenterMemberColumnKeys);
  const columnPlacements = orderedColumnKeys.map((columnKey) => {
    const columnNodes = nodesByColumnKey.get(columnKey) ?? [];
    const zone = resolveCenterMemberZone(centerNode, columnNodes[0], edges);
    const dimensions = columnNodes.map((node) => ({
      node,
      width: getNodeWidth(node),
      height: getNodeHeight(node),
    }));
    const columnWidth = dimensions.reduce((maxWidth, dimension) => Math.max(maxWidth, dimension.width), 0);
    const columnHeight = dimensions.reduce(
      (totalHeight, dimension, index) => totalHeight + dimension.height + (index < dimensions.length - 1 ? CLUSTER_MEMBER_GAP_Y : 0),
      0
    );

    return {
      columnKey,
      zone,
      dimensions,
      width: columnWidth,
      height: columnHeight,
    };
  });

  const topZoneHeight = columnPlacements
    .filter((column) => column.zone === 'top')
    .reduce((maxHeight, column) => Math.max(maxHeight, column.height), 0);
  const centerBandTopY = startY + (topZoneHeight > 0 ? topZoneHeight + CLUSTER_NODE_GAP_Y : 0);
  const centerBandBottomY = centerBandTopY + centerNodeHeight;
  const layouts: LayoutNodeDraft[] = [];
  let columnX = startX;
  let maxRight = 0;
  let maxBottom = startY;

  columnPlacements.forEach((column, columnIndex) => {
    const columnTopY = column.zone === 'top'
      ? centerBandTopY - CLUSTER_NODE_GAP_Y - column.height
      : column.zone === 'bottom'
        ? centerBandBottomY + CLUSTER_NODE_GAP_Y
        : centerBandTopY;
    let columnY = columnTopY;

    column.dimensions.forEach(({ node, width, height }, nodeIndex) => {
      layouts.push({
        node,
        width,
        height,
        position: {
          x: columnX,
          y: columnY,
        },
      });
      columnY += height + (nodeIndex < column.dimensions.length - 1 ? CLUSTER_MEMBER_GAP_Y : 0);
    });

    maxBottom = Math.max(maxBottom, columnY);
    maxRight = Math.max(maxRight, columnX + column.width);

    if (columnIndex < columnPlacements.length - 1) {
      columnX += column.width + CLUSTER_ANCHOR_MEMBER_GAP_X;
    }
  });

  return {
    layouts,
    bottomY: maxBottom,
    maxRight,
  };
};

const placeClusterMembers = (clusterId: string, nodes: AppNode[], edges: AppEdge[]): ClusterPlacement => {
  const orderedNodes = sortNodesByLayoutOrder(nodes);
  const clusterNode = orderedNodes.find(isClusterNode);
  const anchorNodes = orderedNodes.filter((node) => isAnchorNode(node) && !isClusterNode(node));
  const memberNodes = orderedNodes.filter((node) => !isClusterNode(node) && !isAnchorNode(node));
  const centerNode = clusterNode ?? anchorNodes[0] ?? memberNodes[0];
  const anchors = clusterNode
    ? anchorNodes
    : anchorNodes.length > 0
      ? anchorNodes
      : memberNodes.slice(0, 1);
  const remainingMembers = memberNodes.filter((node) => !anchors.some((anchorNode) => anchorNode.id === node.id));
  const memberGroups = new Map<string, AppNode[]>();
  const anchorIdSet = new Set(anchors.map((node) => node.id));
  const centerNodeId = centerNode?.id;

  const resolveMemberAnchorKey = (node: AppNode) => {
    if (centerNodeId) {
      const connectedCenterEdge = edges.find((edge) => (
        (edge.source === node.id && edge.target === centerNodeId) ||
        (edge.target === node.id && edge.source === centerNodeId)
      ));
      if (connectedCenterEdge) {
        return centerNodeId;
      }
    }
    const connectedAnchorEdge = edges.find((edge) => (
      (edge.source === node.id && anchorIdSet.has(edge.target)) ||
      (edge.target === node.id && anchorIdSet.has(edge.source))
    ));
    if (connectedAnchorEdge) {
      return connectedAnchorEdge.source === node.id ? connectedAnchorEdge.target : connectedAnchorEdge.source;
    }
    if (typeof node.data.layoutGroupId === 'string' && node.data.layoutGroupId.trim()) {
      return `group:${node.data.layoutGroupId.trim()}`;
    }
    return node.id;
  };

  remainingMembers.forEach((node) => {
    const groupKey = resolveMemberAnchorKey(node);
    memberGroups.set(groupKey, [...(memberGroups.get(groupKey) ?? []), node]);
  });

  const members: LayoutNodeDraft[] = [];
  const clusterNodeWidth = clusterNode ? getNodeWidth(clusterNode) : 0;
  const clusterNodeHeight = clusterNode ? getNodeHeight(clusterNode) : 0;
  const centerNodeWidth = centerNode ? getNodeWidth(centerNode) : 0;
  const centerNodeHeight = centerNode ? getNodeHeight(centerNode) : 0;
  const anchorBaseX = centerNode
    ? centerNodeWidth + CLUSTER_LAYOUT_PADDING_X * 2
    : CLUSTER_LAYOUT_PADDING_X;
  let nextY = CLUSTER_LAYOUT_PADDING_Y;
  let maxRight = 0;

  const groupedCenterMembers = centerNodeId
    ? memberGroups.get(centerNodeId) ?? []
    : [];

  if (clusterNode && groupedCenterMembers.length > 0) {
    const centerPlacement = placeCenterMemberColumns(
      groupedCenterMembers,
      centerNode,
      centerNodeHeight,
      edges,
      anchorBaseX,
      nextY
    );
    members.push(...centerPlacement.layouts);
    maxRight = Math.max(maxRight, centerPlacement.maxRight);
    nextY = centerPlacement.bottomY + (anchors.length > 0 ? CLUSTER_NODE_GAP_Y : 0);
  }

  anchors.forEach((anchorNode, index) => {
    const anchorWidth = getNodeWidth(anchorNode);
    const anchorHeight = getNodeHeight(anchorNode);
    const anchorX = anchorBaseX;
    const anchorY = nextY;
    members.push({
      node: anchorNode,
      width: anchorWidth,
      height: anchorHeight,
      position: {
        x: anchorX,
        y: anchorY,
      },
    });

    const groupedMembers = [
      ...(memberGroups.get(anchorNode.id) ?? []),
      ...(memberGroups.get(`group:${anchorNode.data.layoutGroupId ?? ''}`) ?? []),
    ].filter((memberNode, memberIndex, memberList) =>
      memberList.findIndex((targetNode) => targetNode.id === memberNode.id) === memberIndex
    );

    if (groupedMembers.length > 0) {
      let memberY = anchorY;
      groupedMembers.forEach((memberNode) => {
        const memberWidth = getNodeWidth(memberNode);
        const memberHeight = getNodeHeight(memberNode);
        members.push({
          node: memberNode,
          width: memberWidth,
          height: memberHeight,
          position: {
            x: anchorX + anchorWidth + CLUSTER_ANCHOR_MEMBER_GAP_X,
            y: memberY,
          },
        });
        memberY += memberHeight + CLUSTER_MEMBER_GAP_Y;
        maxRight = Math.max(maxRight, anchorX + anchorWidth + CLUSTER_ANCHOR_MEMBER_GAP_X + memberWidth);
      });
      nextY = Math.max(nextY + anchorHeight, memberY - CLUSTER_MEMBER_GAP_Y);
    } else {
      nextY += anchorHeight;
      maxRight = Math.max(maxRight, anchorX + anchorWidth);
    }

    if (index < anchors.length - 1) {
      nextY += CLUSTER_NODE_GAP_Y;
    }
  });

  const unassignedMembers = remainingMembers.filter((node) =>
    !members.some((layoutNode) => layoutNode.node.id === node.id)
  );

  if (clusterNode && anchors.length === 0 && unassignedMembers.length > 0) {
    const unassignedPlacement = placeCenterMemberColumns(
      unassignedMembers,
      centerNode,
      centerNodeHeight,
      edges,
      anchorBaseX,
      nextY
    );
    members.push(...unassignedPlacement.layouts);
    nextY = unassignedPlacement.bottomY;
    maxRight = Math.max(maxRight, unassignedPlacement.maxRight);
  } else {
    unassignedMembers.forEach((memberNode, index) => {
      const width = getNodeWidth(memberNode);
      const height = getNodeHeight(memberNode);
      const unassignedMemberX = anchorBaseX + CLUSTER_ANCHOR_MEMBER_GAP_X;
      members.push({
        node: memberNode,
        width,
        height,
        position: {
          x: unassignedMemberX,
          y: nextY,
        },
      });
      nextY += height + (index < unassignedMembers.length - 1 ? CLUSTER_MEMBER_GAP_Y : 0);
      maxRight = Math.max(maxRight, unassignedMemberX + width);
    });
  }

  if (clusterNode) {
    const nonClusterMembers = members.filter((layoutNode) => layoutNode.node.id !== clusterNode.id);
    const contentTop = nonClusterMembers.length > 0
      ? Math.min(...nonClusterMembers.map((layoutNode) => layoutNode.position.y))
      : CLUSTER_LAYOUT_PADDING_Y;
    const contentBottom = nonClusterMembers.length > 0
      ? Math.max(...nonClusterMembers.map((layoutNode) => layoutNode.position.y + layoutNode.height))
      : contentTop + clusterNodeHeight;
    const clusterNodeY = contentTop + (contentBottom - contentTop - clusterNodeHeight) / 2;

    members.push({
      node: clusterNode,
      width: clusterNodeWidth,
      height: clusterNodeHeight,
      position: {
        x: CLUSTER_LAYOUT_PADDING_X,
        y: Math.max(CLUSTER_LAYOUT_PADDING_Y, clusterNodeY),
      },
    });
    maxRight = Math.max(maxRight, CLUSTER_LAYOUT_PADDING_X + clusterNodeWidth);
  } else if (centerNode && !members.some((layoutNode) => layoutNode.node.id === centerNode.id)) {
    members.push({
      node: centerNode,
      width: centerNodeWidth,
      height: centerNodeHeight,
      position: {
        x: CLUSTER_LAYOUT_PADDING_X,
        y: CLUSTER_LAYOUT_PADDING_Y,
      },
    });
    maxRight = Math.max(maxRight, CLUSTER_LAYOUT_PADDING_X + centerNodeWidth);
  }

  const maxBottom = members.reduce(
    (bottom, layoutNode) => Math.max(bottom, layoutNode.position.y + layoutNode.height),
    CLUSTER_LAYOUT_PADDING_Y
  );

  return {
    id: clusterId,
    width: maxRight + CLUSTER_LAYOUT_PADDING_X,
    height: maxBottom + CLUSTER_LAYOUT_PADDING_Y,
    members,
  };
};

const buildClusterEdges = (clusters: ClusterPlacement[], edges: AppEdge[]) => {
  const clusterIdByNodeId = new Map<string, string>();
  clusters.forEach((cluster) => {
    cluster.members.forEach((layoutNode) => {
      clusterIdByNodeId.set(layoutNode.node.id, cluster.id);
    });
  });
  const clusterEdgeWeights = new Map<string, number>();

  edges.forEach((edge) => {
    const sourceClusterId = clusterIdByNodeId.get(edge.source);
    const targetClusterId = clusterIdByNodeId.get(edge.target);
    if (!sourceClusterId || !targetClusterId || sourceClusterId === targetClusterId) {
      return;
    }
    const edgeKey = `${sourceClusterId}::${targetClusterId}`;
    clusterEdgeWeights.set(edgeKey, (clusterEdgeWeights.get(edgeKey) ?? 0) + getRelationWeight(edge));
  });

  return Array.from(clusterEdgeWeights.entries()).map(([edgeKey, weight]) => {
    const [source, target] = edgeKey.split('::');
    return { source, target, weight };
  });
};

export const hasClusterLayoutHints = (nodes: AppNode[]) =>
  nodes.some((node) => typeof node.data.layoutClusterId === 'string' && node.data.layoutClusterId.trim().length > 0);

export const resolveClusterLayoutPositions = ({ nodes, edges }: GraphClusterLayoutInput) => {
  const nodesByClusterId = new Map<string, AppNode[]>();
  nodes.forEach((node) => {
    const clusterId = getClusterId(node);
    nodesByClusterId.set(clusterId, [...(nodesByClusterId.get(clusterId) ?? []), node]);
  });

  const clusters = Array.from(nodesByClusterId.entries()).map(([clusterId, clusterNodes]) =>
    placeClusterMembers(clusterId, clusterNodes, edges)
  );
  const clusterGraph = new dagre.graphlib.Graph();
  clusterGraph.setDefaultEdgeLabel(() => ({}));
  clusterGraph.setGraph({
    rankdir: 'LR',
    nodesep: CLUSTER_LAYOUT_GAP_Y,
    ranksep: CLUSTER_LAYOUT_GAP_X,
  });

  clusters.forEach((cluster) => {
    clusterGraph.setNode(cluster.id, {
      width: cluster.width,
      height: cluster.height,
    });
  });

  buildClusterEdges(clusters, edges).forEach((edge) => {
    clusterGraph.setEdge(edge.source, edge.target, {
      weight: edge.weight,
      minlen: Math.max(1, edge.weight),
    });
  });

  dagre.layout(clusterGraph);

  const nextPositions = new Map<string, LayoutPoint>();
  clusters.forEach((cluster) => {
    const clusterPosition = clusterGraph.node(cluster.id);
    const clusterOriginX = clusterPosition.x - cluster.width / 2;
    const clusterOriginY = clusterPosition.y - cluster.height / 2;

    cluster.members.forEach((layoutNode) => {
      nextPositions.set(layoutNode.node.id, {
        x: clusterOriginX + layoutNode.position.x,
        y: clusterOriginY + layoutNode.position.y,
      });
    });
  });

  return nextPositions;
};
