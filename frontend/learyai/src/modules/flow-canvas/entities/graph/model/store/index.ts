/** 责任：创建白板图 Zustand 状态容器并注册节点边操作。 */
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
} from '@xyflow/react';
import type {
  Connection,
  Edge,
  EdgeChange,
  NodeChange,
} from '@xyflow/react';
import { createStore } from 'zustand/vanilla';

import { createSnapshot, pushSnapshot, shouldTrackEdgeChanges, shouldTrackNodeChanges } from '../effects/history';
import { optimizeGraphLayout } from '../effects/layout';
import { duplicateNode, getNodeSourceId, getNodeZIndex } from '../effects/nodeRules';
import type { AppNode, GraphState } from '../types';

export type GraphStoreApi = ReturnType<typeof createGraphStore>;

export const createGraphStore = () =>
  createStore<GraphState>((set, get) => ({
    nodes: [],
    edges: [],
    history: [],
    selectedTags: [],
    onNodesChange: (changes: NodeChange<AppNode>[]) => {
      const currentState = get();
      const nextNodes = applyNodeChanges(changes, get().nodes).map((node) => ({
        ...node,
        zIndex: getNodeZIndex(node),
      }));

      set({
        history: shouldTrackNodeChanges(changes) ? pushSnapshot(currentState.history, createSnapshot(currentState)) : currentState.history,
        nodes: nextNodes,
      });
    },
    onEdgesChange: (changes: EdgeChange[]) => {
      const currentState = get();
      set({
        history: shouldTrackEdgeChanges(changes) ? pushSnapshot(currentState.history, createSnapshot(currentState)) : currentState.history,
        edges: applyEdgeChanges(changes, get().edges),
      });
    },
    onConnect: (connection: Connection) => {
      const currentState = get();
      set({
        history: pushSnapshot(currentState.history, createSnapshot(currentState)),
        edges: addEdge({ ...connection }, get().edges),
      });
    },
    setNodes: (nodesOrUpdater) => {
      const nextNodes = typeof nodesOrUpdater === 'function'
        ? (nodesOrUpdater as (prev: AppNode[]) => AppNode[])(get().nodes)
        : nodesOrUpdater;
      set({ nodes: nextNodes });
    },
    setEdges: (edgesOrUpdater) => {
      const nextEdges = typeof edgesOrUpdater === 'function'
        ? (edgesOrUpdater as (prev: Edge[]) => Edge[])(get().edges)
        : edgesOrUpdater;
      set({ edges: nextEdges });
    },
    setSelectedTags: (tags) => set({ selectedTags: tags }),
    pushHistory: () => {
      const currentState = get();
      set({
        history: pushSnapshot(currentState.history, createSnapshot(currentState)),
      });
    },
    undo: () => {
      const { history } = get();
      const previousSnapshot = history[history.length - 1];

      if (!previousSnapshot) {
        return;
      }

      set({
        nodes: previousSnapshot.nodes,
        edges: previousSnapshot.edges,
        history: history.slice(0, -1),
      });
    },
    addNode: (node) => {
      const currentState = get();
      const newNode = {
        ...node,
        zIndex: getNodeZIndex(node),
      };
      set({
        history: pushSnapshot(currentState.history, createSnapshot(currentState)),
        nodes: [...currentState.nodes, newNode],
      });
    },
    duplicateNodes: (nodeIds) => {
      const currentState = get();
      const nodeIdSet = new Set<string>(nodeIds);
      const existingNodeIds = new Set<string>(currentState.nodes.map((node) => node.id));
      const duplicatedNodes = currentState.nodes
        .filter((node) => nodeIdSet.has(node.id))
        .map((node, index) => duplicateNode(node, existingNodeIds, index));

      if (duplicatedNodes.length === 0) {
        return [];
      }

      set({
        history: pushSnapshot(currentState.history, createSnapshot(currentState)),
        nodes: [
          ...currentState.nodes.map((node) => ({
            ...node,
            selected: false,
            zIndex: getNodeZIndex({ ...node, selected: false }),
          })),
          ...duplicatedNodes,
        ],
      });

      return duplicatedNodes;
    },
    deleteElements: (nodeIds, edgeIds) => {
      const currentState = get();
      const nodeIdSet = new Set<string>(nodeIds);
      const directEdgeIdSet = new Set<string>(edgeIds);
      set({
        history: pushSnapshot(currentState.history, createSnapshot(currentState)),
        nodes: currentState.nodes.filter((node) => !nodeIdSet.has(node.id)),
        edges: currentState.edges.filter((edge) =>
          !directEdgeIdSet.has(edge.id) &&
          !nodeIdSet.has(edge.source) &&
          !nodeIdSet.has(edge.target)
        ),
      });
    },
    updateNodeData: (nodeId, data) => {
      const currentState = get();
      const targetNode = currentState.nodes.find((node) => node.id === nodeId);

      if (!targetNode) {
        return;
      }

      const targetSourceNodeId = getNodeSourceId(targetNode);
      set({
        history: pushSnapshot(currentState.history, createSnapshot(currentState)),
        nodes: currentState.nodes.map((node) =>
          getNodeSourceId(node) === targetSourceNodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  ...data,
                },
              }
            : node
        ),
      });
    },
    updateEdgeData: (edgeId, label) => {
      const currentState = get();
      set({
        history: pushSnapshot(currentState.history, createSnapshot(currentState)),
        edges: currentState.edges.map((edge) =>
          edge.id === edgeId
            ? {
                ...edge,
                label,
              }
            : edge
        ),
      });
    },
    optimizeLayout: () => {
      const currentState = get();

      if (currentState.nodes.length === 0) {
        return;
      }

      const nextGraph = optimizeGraphLayout({
        nodes: currentState.nodes,
        edges: currentState.edges,
      });

      set({
        history: pushSnapshot(currentState.history, createSnapshot(currentState)),
        nodes: nextGraph.nodes,
        edges: nextGraph.edges,
      });
    },
  }));
