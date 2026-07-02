/** 责任：维护白板节点、边与选区右键菜单状态及菜单项生成逻辑。 */
import React, { useCallback, useState } from 'react';
import type { Edge, Node } from '@xyflow/react';
import { Copy, Edit, Trash2 } from 'lucide-react';

import type { ContextMenuOption } from '../../../../shared/ui/ContextMenu';

interface EditingTarget {
  id: string;
  type: 'node' | 'edge';
  value: string;
}

interface UseWhiteboardContextMenuParams {
  edges: Edge[];
  startEditing: (target: EditingTarget) => void;
  duplicateNodeIds: (nodeIds: string[]) => void;
  deleteElements: (nodeIds: string[], edgeIds: string[]) => void;
  updateEdgeData: (edgeId: string, label: string) => void;
}

const isResourceNodeId = (nodeId: string) =>
  nodeId.startsWith('kbdoc:') || nodeId.startsWith('template:');

export const buildNodeContextMenuOptions = (
  node: Node,
  startEditing: (target: EditingTarget) => void,
  duplicateNodeIds: (nodeIds: string[]) => void,
  deleteElements: (nodeIds: string[], edgeIds: string[]) => void
): ContextMenuOption[] => {
  const options: ContextMenuOption[] = [
    {
      label: '编辑内容',
      icon: <Edit size={14} />,
      onClick: () => startEditing({ id: node.id, type: 'node', value: node.data.label as string }),
    },
  ];

  if (!isResourceNodeId(node.id)) {
    options.push({
      label: '复制节点',
      icon: <Copy size={14} />,
      onClick: () => duplicateNodeIds([node.id]),
    });
  }

  options.push({
    label: '删除节点',
    icon: <Trash2 size={14} />,
    onClick: () => deleteElements([node.id], []),
    variant: 'danger',
  });

  return options;
};

export const buildSelectionContextMenuOptions = (
  selectedNodeIds: string[],
  selectedEdgeIds: string[],
  duplicateNodeIds: (nodeIds: string[]) => void,
  deleteElements: (nodeIds: string[], edgeIds: string[]) => void
): ContextMenuOption[] => {
  const duplicableNodeIds = selectedNodeIds.filter((nodeId) => !isResourceNodeId(nodeId));
  const options: ContextMenuOption[] = [];

  if (duplicableNodeIds.length > 0) {
    options.push({
      label: '复制节点',
      icon: <Copy size={14} />,
      onClick: () => duplicateNodeIds(duplicableNodeIds),
    });
  }

  options.push({
    label: '删除选中项',
    icon: <Trash2 size={14} />,
    onClick: () => deleteElements(selectedNodeIds, selectedEdgeIds),
    variant: 'danger',
  });

  return options;
};

export const useWhiteboardContextMenu = ({
  edges,
  startEditing,
  duplicateNodeIds,
  deleteElements,
  updateEdgeData,
}: UseWhiteboardContextMenuParams) => {
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    options: ContextMenuOption[];
  }>({
    isOpen: false,
    x: 0,
    y: 0,
    options: [],
  });

  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setContextMenu({
      isOpen: true,
      x: event.clientX,
      y: event.clientY,
      options: buildNodeContextMenuOptions(node, startEditing, duplicateNodeIds, deleteElements),
    });
  }, [deleteElements, duplicateNodeIds, startEditing]);

  const onEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    const currentLabel = typeof edge.label === 'string' ? edge.label : '';
    const hasLabel = currentLabel.trim().length > 0;
    setContextMenu({
      isOpen: true,
      x: event.clientX,
      y: event.clientY,
      options: [
        {
          label: hasLabel ? '编辑说明' : '添加说明',
          icon: <Edit size={14} />,
          onClick: () => startEditing({ id: edge.id, type: 'edge', value: currentLabel }),
        },
        ...(hasLabel
          ? [{
              label: '删除说明',
              icon: <Trash2 size={14} />,
              onClick: () => updateEdgeData(edge.id, ''),
            } satisfies ContextMenuOption]
          : []),
        {
          label: '删除连接',
          icon: <Trash2 size={14} />,
          onClick: () => deleteElements([], [edge.id]),
          variant: 'danger',
        },
      ],
    });
  }, [deleteElements, startEditing, updateEdgeData]);

  const onSelectionContextMenu = useCallback((event: React.MouseEvent, selectedNodes: Node[]) => {
    event.preventDefault();
    const selectedNodeIds = selectedNodes.map((node) => node.id);
    const selectedNodeIdSet = new Set(selectedNodeIds);
    const selectedEdgeIds = edges
      .filter((edge) => edge.selected || (selectedNodeIdSet.has(edge.source) && selectedNodeIdSet.has(edge.target)))
      .map((edge) => edge.id);

    if (selectedNodeIds.length === 0 && selectedEdgeIds.length === 0) {
      return;
    }

    setContextMenu({
      isOpen: true,
      x: event.clientX,
      y: event.clientY,
      options: buildSelectionContextMenuOptions(
        selectedNodeIds,
        selectedEdgeIds,
        duplicateNodeIds,
        deleteElements
      ),
    });
  }, [deleteElements, duplicateNodeIds, edges]);

  return {
    contextMenu,
    closeContextMenu,
    onNodeContextMenu,
    onEdgeContextMenu,
    onSelectionContextMenu,
  };
};
