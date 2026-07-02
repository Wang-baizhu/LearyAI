/** 责任：维护白板 ReactFlow 节点、边类型与默认连线配置。 */
import { MarkerType } from '@xyflow/react';

import { ResizableNode, AnnotationNode } from '../ui/CustomNodes';
import { SmartReconnectEdge } from '../ui/SmartReconnectEdge';

export const nodeTypes = {
  resizable: ResizableNode,
  annotation: AnnotationNode,
};

export const edgeTypes = {
  smart: SmartReconnectEdge,
};

export const defaultEdgeOptions = {
  type: 'smart',
  animated: false,
  style: { strokeWidth: 2, stroke: '#64748b' },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: '#64748b',
  },
  reconnectable: true,
};
