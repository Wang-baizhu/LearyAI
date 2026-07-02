/** 责任：装配白板画布、图状态、交互模型与展示组件。 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { MarkerType } from '@xyflow/react';
import type { Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { FlowCanvasSnapshot } from '../../entities/board';
import { createGraphStore } from '../../entities/graph';
import type { AppNode, AppEdge } from '../../entities/graph';
import { reconnectHandleStyle } from './config/reconnectStyles';
import { resolveVisibleEdges, resolveVisibleNodes } from './lib/visibleGraph';
import {
  useEdgeReconnect,
  useWhiteboardContextMenu,
  useWhiteboardKeyboardShortcuts,
  useWhiteboardSnapshotSync,
} from './model';
import { EditDialog } from './ui/EditDialog';
import { WhiteboardCanvas } from './ui/WhiteboardCanvas';

interface FlowViewportControls {
  fitView: (options?: { padding?: number; duration?: number }) => Promise<boolean>;
}

interface EditingItem {
  id: string;
  type: 'node' | 'edge';
  initialValue: string;
}

interface WhiteboardProps {
  initialNodes?: AppNode[];
  initialEdges?: Edge[];
  className?: string;
  onSnapshotChange?: (snapshot: FlowCanvasSnapshot) => void;
  onOpenNode?: (payload: { nodeId: string; label: string; refId?: string; refKind?: 'kbdoc' | 'template' }) => void;
}

export const Whiteboard = ({
  initialNodes = [],
  initialEdges = [],
  className,
  onSnapshotChange,
  onOpenNode,
}: WhiteboardProps) => {
  const [graphStore] = useState(() => createGraphStore());
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    selectedTags,
    setNodes,
    setEdges,
    pushHistory,
    undo,
    duplicateNodes,
    deleteElements,
    updateNodeData,
    updateEdgeData,
    optimizeLayout,
  } = useStore(graphStore);
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
  const [editValue, setEditValue] = useState('');
  const reactFlowInstanceRef = useRef<FlowViewportControls | null>(null);

  const startEditing = useCallback((target: { id: string; type: 'node' | 'edge'; value: string }) => {
    setEditingItem({ id: target.id, type: target.type, initialValue: target.value });
    setEditValue(target.value);
  }, []);

  const saveEdit = useCallback(() => {
    if (!editingItem) {
      return;
    }

    if (editingItem.type === 'node') {
      updateNodeData(editingItem.id, { label: editValue });
    } else {
      updateEdgeData(editingItem.id, editValue);
    }

    setEditingItem(null);
  }, [editValue, editingItem, updateEdgeData, updateNodeData]);

  const {
    contextMenu,
    closeContextMenu,
    onNodeContextMenu,
    onEdgeContextMenu,
    onSelectionContextMenu,
  } = useWhiteboardContextMenu({
    edges,
    startEditing,
    duplicateNodeIds: (nodeIds) => {
      duplicateNodes(nodeIds);
    },
    deleteElements,
    updateEdgeData,
  });
  const { onReconnectStart, onReconnect, onReconnectEnd } = useEdgeReconnect({
    edges,
    pushHistory,
    setEdges,
  });

  useWhiteboardSnapshotSync({
    initialNodes,
    initialEdges,
    nodes,
    edges,
    setNodes,
    setEdges,
    onSnapshotChange,
  });
  useWhiteboardKeyboardShortcuts({
    editingItem,
    nodes,
    edges,
    closeContextMenu,
    undo,
    deleteElements,
  });

  const visibleNodes = useMemo(
    () => resolveVisibleNodes(nodes, selectedTags),
    [nodes, selectedTags]
  );
  const visibleEdges = useMemo(() => resolveVisibleEdges(edges, visibleNodes), [edges, visibleNodes]);
  const emphasizedGraph = useMemo(() => {
    const selectedNodeIds = new Set(visibleNodes.filter((node) => node.selected).map((node) => node.id));
    const hasNodeSelection = selectedNodeIds.size > 0;
    const relatedNodeIds = new Set<string>(selectedNodeIds);
    const focusedEdgeIds = new Set<string>();

    if (hasNodeSelection) {
      visibleEdges.forEach((edge) => {
        if (!selectedNodeIds.has(edge.source) && !selectedNodeIds.has(edge.target)) {
          return;
        }
        focusedEdgeIds.add(edge.id);
        relatedNodeIds.add(edge.source);
        relatedNodeIds.add(edge.target);
      });
    }

    const nextNodes = visibleNodes.map((node) => {
      const emphasis: AppNode['data']['emphasis'] = hasNodeSelection
        ? selectedNodeIds.has(node.id)
          ? 'focus'
          : relatedNodeIds.has(node.id)
            ? 'related'
            : 'dim'
        : undefined;
      const baseZIndex = typeof node.zIndex === 'number' ? node.zIndex : 0;

      return {
        ...node,
        zIndex: hasNodeSelection
          ? selectedNodeIds.has(node.id)
            ? 3000
            : relatedNodeIds.has(node.id)
              ? 2500
              : baseZIndex
          : baseZIndex,
        style: hasNodeSelection && emphasis === 'dim'
          ? {
              ...node.style,
              opacity: 0.24,
            }
          : {
              ...node.style,
              opacity: 1,
            },
        data: {
          ...node.data,
          emphasis,
          onOpenResource: onOpenNode,
        },
      };
    });

    const nextEdges = visibleEdges.map((edge) => {
      const edgeEmphasis = hasNodeSelection
        ? focusedEdgeIds.has(edge.id)
          ? 'focus'
          : 'dim'
        : undefined;
      const markerColor = edgeEmphasis === 'dim' ? '#cbd5e1' : '#475569';

      return {
        ...edge,
        zIndex: hasNodeSelection ? (focusedEdgeIds.has(edge.id) ? 5000 : 0) : edge.zIndex,
        style: {
          ...edge.style,
          opacity: hasNodeSelection ? (focusedEdgeIds.has(edge.id) ? 1 : 0.16) : 1,
          stroke: markerColor,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: markerColor,
        },
        data: {
          ...edge.data,
          emphasis: edgeEmphasis,
          overlayZIndex: hasNodeSelection ? (focusedEdgeIds.has(edge.id) ? 5000 : 0) : undefined,
          onEditLabel: (edgeId: string, currentLabel: string) =>
            startEditing({ id: edgeId, type: 'edge', value: currentLabel }),
        },
      } as AppEdge;
    });

    return {
      nodes: nextNodes,
      edges: nextEdges,
    };
  }, [onOpenNode, startEditing, visibleEdges, visibleNodes]);

  const fitViewAfterGraphChange = useCallback(() => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        reactFlowInstanceRef.current?.fitView({
          padding: 0.2,
          duration: 300,
        });
      });
    });
  }, []);

  const handleOptimizeLayout = useCallback(() => {
    optimizeLayout();
    fitViewAfterGraphChange();
  }, [fitViewAfterGraphChange, optimizeLayout]);

  return (
    <div className={`relative w-full h-full bg-slate-50 overflow-hidden ${className ?? ''}`}>
      <style>{reconnectHandleStyle}</style>
      <WhiteboardCanvas
        nodes={emphasizedGraph.nodes}
        edges={emphasizedGraph.edges}
        graphStore={graphStore}
        contextMenu={contextMenu}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={(instance) => {
          reactFlowInstanceRef.current = instance;
        }}
        closeContextMenu={closeContextMenu}
        onSelectionContextMenu={onSelectionContextMenu}
        onReconnectStart={onReconnectStart}
        onReconnect={onReconnect}
        onReconnectEnd={onReconnectEnd}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onEditNode={(node) =>
          startEditing({ id: node.id, type: 'node', value: node.data.label as string })
        }
        onEditEdge={(edge) =>
          startEditing({ id: edge.id, type: 'edge', value: (edge.label as string) || '' })
        }
        onOptimizeLayout={handleOptimizeLayout}
      />

      <EditDialog
        editingItem={editingItem}
        editValue={editValue}
        onEditValueChange={setEditValue}
        onSave={saveEdit}
        onCancel={() => setEditingItem(null)}
      />
    </div>
  );
};
