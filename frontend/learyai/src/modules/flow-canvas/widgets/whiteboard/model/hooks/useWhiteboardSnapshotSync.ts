/** 责任：同步白板初始图数据，并在图状态变更时上抛可持久化快照。 */
import { useEffect, useRef } from 'react';
import type { Edge } from '@xyflow/react';

import type { FlowCanvasSnapshot } from '../../../../entities/board';
import { getNodeZIndex } from '../../../../entities/graph';
import type { AppNode } from '../../../../entities/graph';
import { stripTransientSelection } from '../../lib/graphSnapshot';

interface UseWhiteboardSnapshotSyncParams {
  initialNodes: AppNode[];
  initialEdges: Edge[];
  nodes: AppNode[];
  edges: Edge[];
  setNodes: (nodes: AppNode[] | ((prev: AppNode[]) => AppNode[])) => void;
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void;
  onSnapshotChange?: (snapshot: FlowCanvasSnapshot) => void;
}

export const useWhiteboardSnapshotSync = ({
  initialNodes,
  initialEdges,
  nodes,
  edges,
  setNodes,
  setEdges,
  onSnapshotChange,
}: UseWhiteboardSnapshotSyncParams) => {
  const isSyncingInitialGraph = useRef(false);
  const hasSyncedInitialGraph = useRef(false);
  const lastSnapshotKeyRef = useRef<string | null>(null);

  useEffect(() => {
    isSyncingInitialGraph.current = true;
    setNodes(initialNodes.map((node) => ({
      ...node,
      zIndex: getNodeZIndex(node),
    })));
    setEdges(initialEdges);
    window.setTimeout(() => {
      const snapshot: FlowCanvasSnapshot = {
        version: 1,
        nodes: initialNodes.map((node) => stripTransientSelection(node)),
        edges: initialEdges.map((edge) => stripTransientSelection(edge)),
      };
      lastSnapshotKeyRef.current = JSON.stringify(snapshot);
      isSyncingInitialGraph.current = false;
      hasSyncedInitialGraph.current = true;
    }, 0);
  }, [initialEdges, initialNodes, setEdges, setNodes]);

  useEffect(() => {
    if (!onSnapshotChange || !hasSyncedInitialGraph.current || isSyncingInitialGraph.current) {
      return;
    }

    const snapshot: FlowCanvasSnapshot = {
      version: 1,
      nodes: nodes.map((node) => stripTransientSelection(node)),
      edges: edges.map((edge) => stripTransientSelection(edge)),
    };
    const snapshotKey = JSON.stringify(snapshot);
    if (snapshotKey === lastSnapshotKeyRef.current) {
      return;
    }

    lastSnapshotKeyRef.current = snapshotKey;
    onSnapshotChange(snapshot);
  }, [edges, nodes, onSnapshotChange]);
};
