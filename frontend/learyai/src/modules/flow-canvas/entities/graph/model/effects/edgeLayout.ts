/** 责任：维护白板边说明尺寸估算与布局连接点选择逻辑。 */
import type { Edge } from '@xyflow/react';

import {
  DEFAULT_EDGE_LABEL_HEIGHT,
  DEFAULT_EDGE_LABEL_WIDTH,
  EDGE_LABEL_CHAR_WIDTH,
  EDGE_LABEL_HORIZONTAL_PADDING,
  EDGE_LABEL_LINE_HEIGHT,
  EDGE_LABEL_MAX_WIDTH,
  EDGE_LABEL_MIN_WIDTH,
} from './constants';
import type { LayoutPoint } from './layoutTypes';
import type { AppNode } from '../types';

interface LayoutNodeConnectionProfile {
  sameKindConnectionCount: number;
  differentKindConnectionCount: number;
  relatedKindCounts?: Record<string, number>;
}

const normalizeEdgeLabelText = (label: Edge['label']) =>
  typeof label === 'string' ? label.trim() : '';

const resolveTemplatePluginId = (node: AppNode | undefined) => {
  const pluginId = typeof node?.data.pluginId === 'string' ? node.data.pluginId.trim() : '';
  if (pluginId) {
    return pluginId;
  }
  return typeof node?.data.templateType === 'string' ? node.data.templateType.trim() : '';
};

export const estimateEdgeLabelLayout = (label: Edge['label']) => {
  const normalizedLabel = normalizeEdgeLabelText(label);
  if (!normalizedLabel) {
    return {
      width: DEFAULT_EDGE_LABEL_WIDTH,
      height: DEFAULT_EDGE_LABEL_HEIGHT,
    };
  }

  const estimatedTextWidth = normalizedLabel.length * EDGE_LABEL_CHAR_WIDTH;
  const width = Math.max(
    EDGE_LABEL_MIN_WIDTH,
    Math.min(EDGE_LABEL_MAX_WIDTH, estimatedTextWidth + EDGE_LABEL_HORIZONTAL_PADDING)
  );
  const lineCount = Math.max(1, Math.ceil((estimatedTextWidth + EDGE_LABEL_HORIZONTAL_PADDING) / EDGE_LABEL_MAX_WIDTH));

  return {
    width,
    height: lineCount * EDGE_LABEL_LINE_HEIGHT,
  };
};

const resolveLayoutNodeKind = (node: AppNode | undefined) => {
  if (!node) {
    return null;
  }
  if (node.data.resourceKind === 'kbdoc') {
    return 'kbdoc';
  }
  if (node.data.resourceKind === 'template') {
    return resolveTemplatePluginId(node) || 'template';
  }
  return node.type === 'annotation' ? 'annotation' : 'custom';
};

const isKbdocToTemplateEdge = (
  sourceNode: AppNode | undefined,
  targetNode: AppNode | undefined
) => sourceNode?.data.resourceKind === 'kbdoc' && targetNode?.data.resourceKind === 'template';

const resolveKbdocTemplateSourceHandle = (targetNode: AppNode | undefined) => {
  const pluginId = resolveTemplatePluginId(targetNode);

  if (pluginId === 'mindmap') {
    return 't-s';
  }

  if (pluginId === 'quiz') {
    return 'r-s';
  }

  return 'b-s';
};

const HORIZONTAL_HUB_MIN_DIFFERENT_KIND_CONNECTIONS = 4;

const isHorizontalHub = (profile?: LayoutNodeConnectionProfile) =>
  (profile?.differentKindConnectionCount ?? 0) >= HORIZONTAL_HUB_MIN_DIFFERENT_KIND_CONNECTIONS;

const getRelatedKindConnectionCount = (
  profile: LayoutNodeConnectionProfile | undefined,
  relatedKind: string | null
) => relatedKind ? (profile?.relatedKindCounts?.[relatedKind] ?? 0) : 0;

const shouldPreferHorizontalForRelatedKind = (
  profile: LayoutNodeConnectionProfile | undefined,
  relatedKind: string | null
) => {
  if (!profile || !relatedKind || !profile.relatedKindCounts) {
    return false;
  }

  const relatedKindCount = getRelatedKindConnectionCount(profile, relatedKind);
  if (relatedKindCount < 2) {
    return false;
  }

  const maxRelatedKindCount = Math.max(0, ...Object.values(profile.relatedKindCounts));
  return relatedKindCount === maxRelatedKindCount;
};

const resolveHorizontalHandles = (
  sourcePoint: LayoutPoint,
  targetPoint: LayoutPoint
) => targetPoint.x >= sourcePoint.x
  ? {
      sourceHandle: 'r-s',
      targetHandle: 'l-t',
    }
  : {
      sourceHandle: 'l-s',
      targetHandle: 'r-t',
    };

const resolveVerticalHandles = (
  sourcePoint: LayoutPoint,
  targetPoint: LayoutPoint
) => targetPoint.y >= sourcePoint.y
  ? {
      sourceHandle: 'b-s',
      targetHandle: 't-t',
    }
  : {
      sourceHandle: 't-s',
      targetHandle: 'b-t',
    };

const resolveSourceHandleByGeometry = (
  sourcePoint: LayoutPoint,
  targetPoint: LayoutPoint
) => Math.abs(targetPoint.x - sourcePoint.x) >= Math.abs(targetPoint.y - sourcePoint.y)
  ? resolveHorizontalHandles(sourcePoint, targetPoint).sourceHandle
  : resolveVerticalHandles(sourcePoint, targetPoint).sourceHandle;

const resolveTargetHandleByGeometry = (
  sourcePoint: LayoutPoint,
  targetPoint: LayoutPoint
) => Math.abs(targetPoint.x - sourcePoint.x) >= Math.abs(targetPoint.y - sourcePoint.y)
  ? resolveHorizontalHandles(sourcePoint, targetPoint).targetHandle
  : resolveVerticalHandles(sourcePoint, targetPoint).targetHandle;

export const resolveEdgeHandlesForLayout = (
  sourcePoint: LayoutPoint,
  targetPoint: LayoutPoint,
  sourceNode?: AppNode,
  targetNode?: AppNode,
  sourceProfile?: LayoutNodeConnectionProfile,
  targetProfile?: LayoutNodeConnectionProfile
) => {
  const sourceKind = resolveLayoutNodeKind(sourceNode);
  const targetKind = resolveLayoutNodeKind(targetNode);
  const horizontalHubInvolved = isHorizontalHub(sourceProfile) || isHorizontalHub(targetProfile);

  if (isKbdocToTemplateEdge(sourceNode, targetNode)) {
    return {
      sourceHandle: resolveKbdocTemplateSourceHandle(targetNode),
      targetHandle: 'l-t',
    };
  }

  if (sourceKind && targetKind) {
    if (sourceKind !== targetKind) {
      const sourcePrefersHorizontal = shouldPreferHorizontalForRelatedKind(sourceProfile, targetKind);
      const targetPrefersHorizontal = shouldPreferHorizontalForRelatedKind(targetProfile, sourceKind);

      if (sourcePrefersHorizontal && targetPrefersHorizontal) {
        return resolveHorizontalHandles(sourcePoint, targetPoint);
      }

      if (sourcePrefersHorizontal) {
        return {
          sourceHandle: resolveHorizontalHandles(sourcePoint, targetPoint).sourceHandle,
          targetHandle: resolveTargetHandleByGeometry(sourcePoint, targetPoint),
        };
      }

      if (targetPrefersHorizontal) {
        return {
          sourceHandle: resolveSourceHandleByGeometry(sourcePoint, targetPoint),
          targetHandle: resolveHorizontalHandles(sourcePoint, targetPoint).targetHandle,
        };
      }

      return {
        sourceHandle: resolveSourceHandleByGeometry(sourcePoint, targetPoint),
        targetHandle: resolveTargetHandleByGeometry(sourcePoint, targetPoint),
      };
    }

    if (horizontalHubInvolved) {
      return Math.abs(targetPoint.x - sourcePoint.x) >= Math.abs(targetPoint.y - sourcePoint.y)
        ? resolveHorizontalHandles(sourcePoint, targetPoint)
        : resolveVerticalHandles(sourcePoint, targetPoint);
    }

    return resolveVerticalHandles(sourcePoint, targetPoint);
  }

  const deltaX = targetPoint.x - sourcePoint.x;
  const deltaY = targetPoint.y - sourcePoint.y;

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return resolveHorizontalHandles(sourcePoint, targetPoint);
  }

  return resolveVerticalHandles(sourcePoint, targetPoint);
};
