// ContextMenu 负责渲染基于锚点定位的全局菜单，避免被父级遮挡。
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ContextMenuProps {
  isOpen: boolean;
  anchorRect: DOMRect | null;
  onClose: () => void;
  children: React.ReactNode;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ isOpen, anchorRect, onClose, children }) => {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current && menuRef.current.contains(target)) {
        return;
      }
      onClose();
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen, onClose]);

  if (!isOpen || !anchorRect) return null;

  const style: React.CSSProperties = {
    position: 'fixed',
    top: anchorRect.bottom + 8,
    left: Math.min(anchorRect.left, window.innerWidth - 180),
    zIndex: 60,
  };

  return createPortal(
    <div ref={menuRef} style={style}>
      {children}
    </div>,
    document.body
  );
};

export default ContextMenu;
