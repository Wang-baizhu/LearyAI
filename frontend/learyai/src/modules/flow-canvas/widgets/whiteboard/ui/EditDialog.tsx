/** 责任：渲染白板节点与边文本编辑弹窗。 */
import { Check } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

interface EditingItem {
  id: string;
  type: 'node' | 'edge';
  initialValue: string;
}

interface EditDialogProps {
  editingItem: EditingItem | null;
  editValue: string;
  onEditValueChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export const EditDialog = ({
  editingItem,
  editValue,
  onEditValueChange,
  onSave,
  onCancel,
}: EditDialogProps) => (
  <AnimatePresence>
    {editingItem && (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/20 backdrop-blur-[2px]"
        onClick={onCancel}
      >
        <div
          className="bg-white p-6 rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm"
          onClick={(event) => event.stopPropagation()}
        >
          <h3 className="text-sm font-semibold text-slate-500 mb-4 uppercase tracking-wider">编辑内容</h3>
          <textarea
            autoFocus
            value={editValue}
            onChange={(event) => onEditValueChange(event.target.value)}
            className="w-full p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none min-h-[120px] text-slate-700 bg-slate-50"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                onSave();
              }
              if (event.key === 'Escape') {
                onCancel();
              }
            }}
          />
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={onSave}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-100 flex items-center gap-2 transition-all active:scale-95"
            >
              <Check size={16} /> 确定
            </button>
          </div>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);
