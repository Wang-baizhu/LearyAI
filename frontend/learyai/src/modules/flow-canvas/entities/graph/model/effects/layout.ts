/** 责任：维护白板图 dagre 自动布局编排逻辑。 */
import dagre from 'dagre';

import {
  DEFAULT_LAYOUT_NODE_HEIGHT,
  DEFAULT_LAYOUT_NODE_WIDTH,
  PARALLEL_EDGE_OFFSET_STEP,
} from './constants';
import { estimateEdgeLabelLayout, resolveEdgeHandlesForLayout } from './edgeLayout';
import { resolveFollowLayoutPositions, splitNodesForLayout } from './followLayout';
import { hasClusterLayoutHints, resolveClusterLayoutPositions } from './resourceClusterLayout';
import { resolveTagAwareLayoutPositions } from './tagLayout';
import type { LayoutNodeDraft } from './layoutTypes';
import type { AppEdge, AppNode } from '../types';

interface GraphLayoutInput {
  nodes: AppNode[];
  edges: AppEdge[];
}

interface LayoutNodeConnectionProfile {
  sameKindConnectionCount: number;
  differentKindConnectionCount: number;
  relatedKindCounts: Record<string, number>;
}

const BASE_LAYOUT_NODESEP = 80;
const BASE_LAYOUT_RANKSEP = 120;
const MAX_LAYOUT_NODESEP = 180;
const MAX_LAYOUT_RANKSEP = 180;

const resolveLayoutNodeKind = (node: AppNode | undefined) => {
  if (!node) {
    return null;
  }
  if (node.data.resourceKind === 'kbdoc') {
    return 'kbdoc';
  }
  if (node.data.resourceKind === 'template') {
    const pluginId = typeof node.data.pluginId === 'string' ? node.data.pluginId.trim() : '';
    if (pluginId) {
      return pluginId;
    }
    const templateType = typeof node.data.templateType === 'string' ? node.data.templateType.trim() : '';
    return templateType || 'template';
  }
  return node.type === 'annotation' ? 'annotation' : 'custom';
};

const buildNodeConnectionProfiles = (nodes: AppNode[], edges: AppEdge[]) => {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const profiles = new Map<string, LayoutNodeConnectionProfile>();

  nodes.forEach((node) => {
    profiles.set(node.id, {
      sameKindConnectionCount: 0,
      differentKindConnectionCount: 0,
      relatedKindCounts: {},
    });
  });

  edges.forEach((edge) => {
    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);

    if (!sourceNode || !targetNode) {
      return;
    }

    if (sourceNode.type === 'annotation' || targetNode.type === 'annotation') {
      return;
    }

    const sourceKind = resolveLayoutNodeKind(sourceNode);
    const targetKind = resolveLayoutNodeKind(targetNode);

    if (!sourceKind || !targetKind) {
      return;
    }

    const isSameKind = sourceKind === targetKind;
    const sourceProfile = profiles.get(sourceNode.id);
    const targetProfile = profiles.get(targetNode.id);

    if (!sourceProfile || !targetProfile) {
      return;
    }

    if (isSameKind) {
      sourceProfile.sameKindConnectionCount += 1;
      targetProfile.sameKindConnectionCount += 1;
      sourceProfile.relatedKindCounts[sourceKind] = (sourceProfile.relatedKindCounts[sourceKind] ?? 0) + 1;
      targetProfile.relatedKindCounts[targetKind] = (targetProfile.relatedKindCounts[targetKind] ?? 0) + 1;
      return;
    }

    sourceProfile.differentKindConnectionCount += 1;
    targetProfile.differentKindConnectionCount += 1;
    sourceProfile.relatedKindCounts[targetKind] = (sourceProfile.relatedKindCounts[targetKind] ?? 0) + 1;
    targetProfile.relatedKindCounts[sourceKind] = (targetProfile.relatedKindCounts[sourceKind] ?? 0) + 1;
  });

  return profiles;
};

const resolveParallelEdgeOffsets = (edges: AppEdge[]) => {
  const offsets = new Map<string, number>();
  const edgeGroups = new Map<string, AppEdge[]>();

  edges.forEach((edge) => {
    const groupKey = [edge.source, edge.target].sort().join('::');
    edgeGroups.set(groupKey, [...(edgeGroups.get(groupKey) ?? []), edge]);
  });

  edgeGroups.forEach((groupEdges) => {
    if (groupEdges.length < 2) {
      return;
    }

    const [firstNodeId, secondNodeId] = [...new Set(groupEdges.flatMap((edge) => [edge.source, edge.target]))]
      .sort((firstId, secondId) => firstId.localeCompare(secondId));
    const canonicalEdges = groupEdges
      .filter((edge) => edge.source === firstNodeId && edge.target === secondNodeId)
      .sort((firstEdge, secondEdge) => firstEdge.id.localeCompare(secondEdge.id));
    const reverseEdges = groupEdges
      .filter((edge) => edge.source === secondNodeId && edge.target === firstNodeId)
      .sort((firstEdge, secondEdge) => firstEdge.id.localeCompare(secondEdge.id));

    if (canonicalEdges.length > 0 && reverseEdges.length > 0) {
      canonicalEdges.forEach((edge, index) => {
        offsets.set(edge.id, -(index + 1) * PARALLEL_EDGE_OFFSET_STEP);
      });

      reverseEdges.forEach((edge, index) => {
        offsets.set(edge.id, -(index + 1) * PARALLEL_EDGE_OFFSET_STEP);
      });

      return;
    }

    const sortedGroupEdges = [...groupEdges].sort((firstEdge, secondEdge) => firstEdge.id.localeCompare(secondEdge.id));
    const centerIndex = (sortedGroupEdges.length - 1) / 2;

    sortedGroupEdges.forEach((edge, index) => {
      const offsetIndex = index - centerIndex;
      const resolvedOffsetIndex = offsetIndex >= 0 ? offsetIndex + 0.5 : offsetIndex - 0.5;
      offsets.set(edge.id, resolvedOffsetIndex * PARALLEL_EDGE_OFFSET_STEP);
    });
  });

  return offsets;
};

const resolveDagreSpacing = (nodes: AppNode[], edges: AppEdge[]) => {
  const connectedNodeIds = new Set(nodes.map((node) => node.id));
  const outgoingCounts = new Map<string, number>();
  const incomingCounts = new Map<string, number>();

  edges.forEach((edge) => {
    if (!connectedNodeIds.has(edge.source) || !connectedNodeIds.has(edge.target)) {
      return;
    }

    outgoingCounts.set(edge.source, (outgoingCounts.get(edge.source) ?? 0) + 1);
    incomingCounts.set(edge.target, (incomingCounts.get(edge.target) ?? 0) + 1);
  });

  const maxOutgoingCount = Math.max(0, ...outgoingCounts.values());
  const maxIncomingCount = Math.max(0, ...incomingCounts.values());
  const branchPressure = Math.max(maxOutgoingCount, maxIncomingCount);
  const extraNodeSep = Math.min(
    MAX_LAYOUT_NODESEP - BASE_LAYOUT_NODESEP,
    Math.max(0, branchPressure - 2) * 12
  );
  const extraRankSep = Math.min(
    MAX_LAYOUT_RANKSEP - BASE_LAYOUT_RANKSEP,
    Math.max(0, branchPressure - 2) * 8
  );

  return {
    nodesep: BASE_LAYOUT_NODESEP + extraNodeSep,
    ranksep: BASE_LAYOUT_RANKSEP + extraRankSep,
  };
};

export const optimizeGraphLayout = ({ nodes, edges }: GraphLayoutInput) => {
  const { primaryNodes, followNodes } = splitNodesForLayout(nodes, edges);
  const layoutNodes = primaryNodes.length > 0 ? primaryNodes : nodes;
  const nodePositions = hasClusterLayoutHints(layoutNodes)
    ? resolveClusterLayoutPositions({
        nodes: layoutNodes,
        edges,
      })
    : (() => {
        const spacing = resolveDagreSpacing(layoutNodes, edges);
        const dagreGraph = new dagre.graphlib.Graph();
        dagreGraph.setDefaultEdgeLabel(() => ({}));
        dagreGraph.setGraph({
          rankdir: 'LR',
          nodesep: spacing.nodesep,
          ranksep: spacing.ranksep,
        });

        layoutNodes.forEach((node) => {
          dagreGraph.setNode(node.id, {
            width: node.measured?.width ?? DEFAULT_LAYOUT_NODE_WIDTH,
            height: node.measured?.height ?? DEFAULT_LAYOUT_NODE_HEIGHT,
          });
        });

        edges
          .filter((edge) => layoutNodes.some((node) => node.id === edge.source) && layoutNodes.some((node) => node.id === edge.target))
          .forEach((edge) => {
            const labelLayout = estimateEdgeLabelLayout(edge.label);
            dagreGraph.setEdge(edge.source, edge.target, {
              width: labelLayout.width,
              height: labelLayout.height,
            });
          });

        dagre.layout(dagreGraph);

        const primaryLayoutNodeDrafts: LayoutNodeDraft[] = layoutNodes.map((node) => {
          const layoutNode = dagreGraph.node(node.id);
          const width = node.measured?.width ?? DEFAULT_LAYOUT_NODE_WIDTH;
          const height = node.measured?.height ?? DEFAULT_LAYOUT_NODE_HEIGHT;

          return {
            node,
            width,
            height,
            position: {
              x: layoutNode.x - width / 2,
              y: layoutNode.y - height / 2,
            },
          };
        });

        return resolveTagAwareLayoutPositions(primaryLayoutNodeDrafts);
      })();
  const primaryLayoutNodeDrafts: LayoutNodeDraft[] = layoutNodes.map((node) => ({
    node,
    width: node.measured?.width ?? DEFAULT_LAYOUT_NODE_WIDTH,
    height: node.measured?.height ?? DEFAULT_LAYOUT_NODE_HEIGHT,
    position: nodePositions.get(node.id) ?? node.position,
  }));
  const followNodePositions = resolveFollowLayoutPositions(primaryLayoutNodeDrafts, followNodes);
  const parallelEdgeOffsets = resolveParallelEdgeOffsets(edges);
  const allNodePositions = new Map([
    ...nodePositions.entries(),
    ...followNodePositions.entries(),
  ]);

  const nextNodes = nodes.map((node) => ({
    ...node,
    position: followNodePositions.get(node.id) ?? nodePositions.get(node.id) ?? node.position,
  }));
  const nodeConnectionProfiles = buildNodeConnectionProfiles(nextNodes, edges);

  const nextEdges = edges.map((edge) => {
    const sourcePoint = allNodePositions.get(edge.source);
    const targetPoint = allNodePositions.get(edge.target);
    const sourceNode = nextNodes.find((node) => node.id === edge.source);
    const targetNode = nextNodes.find((node) => node.id === edge.target);

    if (!sourcePoint || !targetPoint) {
      return edge;
    }

    const nextHandles = resolveEdgeHandlesForLayout(
      sourcePoint,
      targetPoint,
      sourceNode,
      targetNode,
      sourceNode ? nodeConnectionProfiles.get(sourceNode.id) : undefined,
      targetNode ? nodeConnectionProfiles.get(targetNode.id) : undefined
    );
    const parallelEdgeOffset = parallelEdgeOffsets.get(edge.id);

    return {
      ...edge,
      sourceHandle: nextHandles.sourceHandle,
      targetHandle: nextHandles.targetHandle,
      data: parallelEdgeOffset
        ? {
            ...edge.data,
            parallelEdgeOffset,
          }
        : edge.data && 'parallelEdgeOffset' in edge.data
          ? {
              ...edge.data,
              parallelEdgeOffset: undefined,
            }
          : edge.data,
    };
  });

  return {
    nodes: nextNodes,
    edges: nextEdges,
  };
};
