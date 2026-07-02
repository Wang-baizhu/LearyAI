/** 责任：维护白板撤销、复制、粘贴与删除快捷键绑定。 */
import { useEffect } from 'react';
import type { Edge } from '@xyflow/react';

import type { AppNode } from '../../../../entities/graph';

interface EditingItem {
  id: string;
  type: 'node' | 'edge';
  initialValue: string;
}

interface UseWhiteboardKeyboardShortcutsParams {
  editingItem: EditingItem | null;
  nodes: AppNode[];
  edges: Edge[];
  closeContextMenu: () => void;
  undo: () => void;
  deleteElements: (nodeIds: string[], edgeIds: string[]) => void;
}

const isEditableTarget = (eventTarget: EventTarget | null) => {
  if (!(eventTarget instanceof HTMLElement)) {
    return false;
  }

  const tagName = eventTarget.tagName.toLowerCase();
  return eventTarget.isContentEditable || tagName === 'input' || tagName === 'textarea';
};

export const useWhiteboardKeyboardShortcuts = ({
  editingItem,
  nodes,
  edges,
  closeContextMenu,
  undo,
  deleteElements,
}: UseWhiteboardKeyboardShortcutsParams) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      const hasModifier = event.ctrlKey || event.metaKey;
      const normalizedKey = event.key.toLowerCase();

      if (hasModifier && normalizedKey === 'z') {
        event.preventDefault();
        closeContextMenu();
        undo();
        return;
      }

      if (editingItem) {
        return;
      }

      if (event.key !== 'Delete' && event.key !== 'Backspace') {
        return;
      }

      const selectedNodeIds = nodes.filter((node) => node.selected).map((node) => node.id);
      const selectedEdgeIds = edges.filter((edge) => edge.selected).map((edge) => edge.id);

      if (selectedNodeIds.length === 0 && selectedEdgeIds.length === 0) {
        return;
      }

      event.preventDefault();
      closeContextMenu();
      deleteElements(selectedNodeIds, selectedEdgeIds);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    closeContextMenu,
    deleteElements,
    editingItem,
    edges,
    nodes,
    undo,
  ]);
};
