/** 责任：渲染支持点击外部与失焦关闭的通用右键菜单。 */
import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { mergeClassName } from '../lib/className';

export interface ContextMenuOption {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
}

interface ContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
  x: number;
  y: number;
  options: ContextMenuOption[];
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ 
  isOpen, 
  onClose, 
  x, 
  y, 
  options 
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleWindowBlur = () => {
      onClose();
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('blur', handleWindowBlur);
      window.addEventListener('resize', handleWindowBlur);
      window.addEventListener('scroll', handleWindowBlur, true);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('resize', handleWindowBlur);
      window.removeEventListener('scroll', handleWindowBlur, true);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.1 }}
          style={{ top: y, left: x }}
          className="fixed z-[9999] min-w-[160px] bg-white/90 backdrop-blur-md rounded-xl shadow-2xl border border-slate-200 p-1.5 overflow-hidden"
        >
          {options.map((option, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                option.onClick();
                onClose();
              }}
              className={mergeClassName(
                "w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer text-left",
                option.variant === 'danger' 
                  ? "text-red-500 hover:bg-red-50" 
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              {option.icon && <span className="flex-shrink-0">{option.icon}</span>}
              <span className="flex-grow">{option.label}</span>
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
