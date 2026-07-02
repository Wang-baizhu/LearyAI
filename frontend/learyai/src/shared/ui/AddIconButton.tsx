// AddIconButton 负责渲染统一的 add 图标按钮样式。
import React from 'react';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';

interface AddIconButtonProps {
  label?: string;
  onClick?: () => void;
}

const AddIconButton: React.FC<AddIconButtonProps> = ({ label = '添加', onClick }) => {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex items-center justify-center w-12 h-12 rounded-2xl bg-accent shadow-lg shadow-accent/20 hover:scale-105 active:scale-95 transition-all"
    >
      <MaterialIcon name="add" className="text-[28px] text-white dark:text-black" />
    </button>
  );
};

export default AddIconButton;
