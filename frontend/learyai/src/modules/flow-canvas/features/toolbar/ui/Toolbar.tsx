// Toolbar 负责提供白板添加节点、注释与布局等快捷操作。
import React from 'react';
import { useStore } from 'zustand';
import { Plus, MessageSquare, Layers } from 'lucide-react';
import { motion } from 'motion/react';
import type { GraphStoreApi } from '../../../entities/graph';
import { mergeClassName } from '../../../shared/lib/className';

interface ToolbarProps {
  store: GraphStoreApi;
  onOptimizeLayout?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ store, onOptimizeLayout }) => {
  const { addNode, optimizeLayout } = useStore(store);
  const handleOptimizeLayout = onOptimizeLayout ?? optimizeLayout;

  const handleAddDefaultNode = () => {
    const id = `node_${Date.now()}`;
    addNode({
      id,
      type: 'resizable',
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: {
        label: `新建节点`,
        tags: ['未分类'],
        description: '双击编辑内容'
      },
    });
  };

  const handleAddAnnotation = () => {
    const id = `note_${Date.now()}`;
    addNode({
      id,
      type: 'annotation',
      position: { x: 100, y: 100 },
      data: {
        label: '📝 新注释',
        tags: ['注释'],
        description: '我是背景块，双击编辑'
      },
    });
  };

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2"
    >
      <div className="flex items-center gap-1 rounded-2xl border border-white/50 bg-white/80 p-2 shadow-2xl backdrop-blur-xl">
        <ToolbarButton
          icon={<Plus size={20} />}
          label="添加节点"
          onClick={handleAddDefaultNode}
          primary
        />
        <div className="mx-1 h-6 w-[1px] bg-slate-200" />
        <ToolbarButton
          icon={<MessageSquare size={19} />}
          label="添加注释"
          onClick={handleAddAnnotation}
        />
        <ToolbarButton
          icon={<Layers size={19} />}
          label="自动布局"
          onClick={handleOptimizeLayout}
        />
      </div>
    </motion.div>
  );
};

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  primary?: boolean;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({ icon, label, onClick, primary }) => (
  <button
    onClick={onClick}
    className={mergeClassName(
      'group relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200',
      primary
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 hover:bg-blue-700'
        : 'text-slate-600 hover:bg-slate-100 hover:text-blue-600'
    )}
  >
    {icon}
    <span className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
      {label}
    </span>
  </button>
);
