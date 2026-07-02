/** 责任：维护白板节点复制、粘贴与重复创建的引用状态。 */
import { useCallback, useRef } from 'react';

import type { AppNode } from '../../../../entities/graph';

export const useNodeClipboard = (duplicateNodes: (nodeIds: string[]) => AppNode[]) => {
  const copiedNodeIdsRef = useRef<string[]>([]);

  const copyNodes = useCallback((nodeIds: string[]) => {
    copiedNodeIdsRef.current = nodeIds;
  }, []);

  const pasteCopiedNodes = useCallback(() => {
    if (copiedNodeIdsRef.current.length === 0) {
      return;
    }

    const duplicatedNodes = duplicateNodes(copiedNodeIdsRef.current);
    copiedNodeIdsRef.current = duplicatedNodes.map((node) => node.id);
  }, [duplicateNodes]);

  const duplicateNodeIds = useCallback((nodeIds: string[]) => {
    const duplicatedNodes = duplicateNodes(nodeIds);
    copiedNodeIdsRef.current = duplicatedNodes.map((node) => node.id);
  }, [duplicateNodes]);

  const hasCopiedNodes = useCallback(() => copiedNodeIdsRef.current.length > 0, []);

  return {
    copyNodes,
    pasteCopiedNodes,
    duplicateNodeIds,
    hasCopiedNodes,
  };
};
