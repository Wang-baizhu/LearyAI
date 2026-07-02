/** 责任：维护白板边重连成功标记、重连应用与失效删除逻辑。 */
import { useCallback, useRef } from 'react';
import { reconnectEdge } from '@xyflow/react';
import type { Connection, Edge, FinalConnectionState } from '@xyflow/react';

interface UseEdgeReconnectParams {
  edges: Edge[];
  pushHistory: () => void;
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void;
}

export const useEdgeReconnect = ({
  edges,
  pushHistory,
  setEdges,
}: UseEdgeReconnectParams) => {
  const edgeReconnectSuccessful = useRef(true);

  const onReconnectStart = useCallback(() => {
    edgeReconnectSuccessful.current = false;
  }, []);

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      edgeReconnectSuccessful.current = true;
      pushHistory();
      setEdges(reconnectEdge(oldEdge, newConnection, edges));
    },
    [edges, pushHistory, setEdges]
  );

  const onReconnectEnd = useCallback(
    (
      _: MouseEvent | TouchEvent,
      edge: Edge,
      handleType: 'source' | 'target',
      connectionState: FinalConnectionState
    ) => {
      void handleType;
      void connectionState;
      if (!edgeReconnectSuccessful.current) {
        pushHistory();
        setEdges((currentEdges) => currentEdges.filter((currentEdge) => currentEdge.id !== edge.id));
      }
      edgeReconnectSuccessful.current = true;
    },
    [pushHistory, setEdges]
  );

  return {
    onReconnectStart,
    onReconnect,
    onReconnectEnd,
  };
};
