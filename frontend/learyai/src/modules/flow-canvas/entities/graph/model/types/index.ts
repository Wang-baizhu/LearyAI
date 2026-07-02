/** 责任：定义白板图模型的节点、快照与状态类型。 */
import type {
  Edge,
  Node,
  OnConnect,
  OnEdgesChange,
  OnNodesChange,
} from '@xyflow/react';

export type LayoutNodeRole = 'cluster' | 'anchor' | 'member';

export type LayoutRelationScope = 'intra-cluster' | 'inter-cluster';

export interface AppNodeData extends Record<string, unknown> {
  label: string;
  tags?: string[];
  description?: string;
  sourceNodeId?: string;
  resourceKind?: 'kbdoc' | 'template' | 'custom';
  refId?: string;
  refKind?: 'kbdoc' | 'template';
  pluginId?: string;
  templateType?: string;
  sourceDocIds?: string[];
  layoutClusterId?: string;
  layoutRole?: LayoutNodeRole;
  layoutGroupId?: string;
  layoutOrder?: number;
  emphasis?: 'focus' | 'related' | 'dim';
  onOpenResource?: (payload: { nodeId: string; label: string; refId?: string; refKind?: 'kbdoc' | 'template' }) => void;
}

export type AppNode = Node<AppNodeData>;

export interface AppEdgeData extends Record<string, unknown> {
  parallelEdgeOffset?: number;
  layoutScope?: LayoutRelationScope;
  relationWeight?: number;
  derived?: boolean;
  emphasis?: 'focus' | 'dim';
  overlayZIndex?: number;
}

export type AppEdge = Edge<AppEdgeData>;

export interface GraphSnapshot {
  nodes: AppNode[];
  edges: AppEdge[];
}

export interface GraphState {
  nodes: AppNode[];
  edges: AppEdge[];
  history: GraphSnapshot[];
  selectedTags: string[];
  onNodesChange: OnNodesChange<AppNode>;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setNodes: (nodes: AppNode[] | ((prev: AppNode[]) => AppNode[])) => void;
  setEdges: (edges: AppEdge[] | ((prev: AppEdge[]) => AppEdge[])) => void;
  setSelectedTags: (tags: string[]) => void;
  pushHistory: () => void;
  undo: () => void;
  addNode: (node: AppNode) => void;
  duplicateNodes: (nodeIds: string[]) => AppNode[];
  deleteElements: (nodeIds: string[], edgeIds: string[]) => void;
  updateNodeData: (nodeId: string, data: Partial<AppNodeData>) => void;
  updateEdgeData: (edgeId: string, label: string) => void;
  optimizeLayout: () => void;
}
