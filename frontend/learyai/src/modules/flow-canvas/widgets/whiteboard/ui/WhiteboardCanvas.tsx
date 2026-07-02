/** 责任：渲染白板 ReactFlow 画布及其内置控制组件。 */
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  SelectionMode,
} from '@xyflow/react';
import type {
  Connection,
  Edge,
  FinalConnectionState,
  Node,
  OnConnect,
  OnEdgesChange,
  OnNodesChange,
} from '@xyflow/react';
import type { MouseEvent as ReactMouseEvent } from 'react';

import type { AppNode, GraphStoreApi } from '../../../entities/graph';
import { TagFilter } from '../../../features/filter-by-tags';
import { Toolbar } from '../../../features/toolbar';
import { ContextMenu } from '../../../shared/ui/ContextMenu';
import type { ContextMenuOption } from '../../../shared/ui/ContextMenu';
import { defaultEdgeOptions, edgeTypes, nodeTypes } from '../config/reactFlowOptions';

interface FlowViewportControls {
  fitView: (options?: { padding?: number; duration?: number }) => Promise<boolean>;
}

interface WhiteboardContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  options: ContextMenuOption[];
}

interface WhiteboardCanvasProps {
  nodes: AppNode[];
  edges: Edge[];
  graphStore: GraphStoreApi;
  contextMenu: WhiteboardContextMenuState;
  onNodesChange: OnNodesChange<AppNode>;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onInit: (instance: FlowViewportControls) => void;
  closeContextMenu: () => void;
  onSelectionContextMenu: (event: ReactMouseEvent, selectedNodes: Node[]) => void;
  onReconnectStart: () => void;
  onReconnect: (oldEdge: Edge, newConnection: Connection) => void;
  onReconnectEnd: (
    event: globalThis.MouseEvent | TouchEvent,
    edge: Edge,
    handleType: 'source' | 'target',
    connectionState: FinalConnectionState
  ) => void;
  onNodeContextMenu: (event: ReactMouseEvent, node: Node) => void;
  onEdgeContextMenu: (event: ReactMouseEvent, edge: Edge) => void;
  onEditNode: (node: Node) => void;
  onEditEdge: (edge: Edge) => void;
  onOptimizeLayout: () => void;
}

export const WhiteboardCanvas = ({
  nodes,
  edges,
  graphStore,
  contextMenu,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onInit,
  closeContextMenu,
  onSelectionContextMenu,
  onReconnectStart,
  onReconnect,
  onReconnectEnd,
  onNodeContextMenu,
  onEdgeContextMenu,
  onEditNode,
  onEditEdge,
  onOptimizeLayout,
}: WhiteboardCanvasProps) => (
  <ReactFlow
    nodes={nodes}
    edges={edges}
    onNodesChange={onNodesChange}
    onEdgesChange={onEdgesChange}
    onConnect={onConnect}
    onInit={onInit}
    deleteKeyCode={null}
    selectionKeyCode="Control"
    multiSelectionKeyCode="Control"
    selectionMode={SelectionMode.Partial}
    onPaneClick={closeContextMenu}
    onMoveStart={closeContextMenu}
    onSelectionStart={closeContextMenu}
    onSelectionDragStart={closeContextMenu}
    onNodeDragStart={closeContextMenu}
    onSelectionContextMenu={onSelectionContextMenu}
    onReconnectStart={onReconnectStart}
    onReconnect={onReconnect}
    onReconnectEnd={onReconnectEnd}
    nodeTypes={nodeTypes}
    edgeTypes={edgeTypes}
    defaultEdgeOptions={defaultEdgeOptions}
    onNodeContextMenu={onNodeContextMenu}
    onEdgeContextMenu={onEdgeContextMenu}
    onNodeDoubleClick={(_, node) => onEditNode(node)}
    onEdgeDoubleClick={(_, edge) => onEditEdge(edge)}
    fitView
    minZoom={0.1}
    snapToGrid
    snapGrid={[15, 15]}
  >
    <Background variant={BackgroundVariant.Dots} gap={30} size={1.5} color="#e2e8f0" />
    <Controls showInteractive={false} className="bg-white border-slate-200 shadow-xl rounded-lg" />
    <MiniMap
      nodeColor="#cbd5e1"
      maskColor="rgb(241, 245, 249, 0.5)"
      className="bg-white border border-slate-200 rounded-lg shadow-lg"
    />
    <TagFilter store={graphStore} />
    <Toolbar store={graphStore} onOptimizeLayout={onOptimizeLayout} />
    <ContextMenu
      isOpen={contextMenu.isOpen}
      onClose={closeContextMenu}
      x={contextMenu.x}
      y={contextMenu.y}
      options={contextMenu.options}
    />
  </ReactFlow>
);
