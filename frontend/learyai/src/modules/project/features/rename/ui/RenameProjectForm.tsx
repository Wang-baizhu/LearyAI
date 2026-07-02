// RenameProjectForm 负责项目重命名表单的输入与提交。
import React, { useState } from 'react';
import type { ProjectRenamePayload } from '../api/projectRenameApi';
import LoadingSpinner from '@/shared/ui/LoadingSpinner';

interface RenameProjectFormProps {
  onSubmit: (payload: ProjectRenamePayload) => void;
  defaultName?: string;
  isSubmitting?: boolean;
}

const RenameProjectForm: React.FC<RenameProjectFormProps> = ({
  onSubmit,
  defaultName,
  isSubmitting = false,
}) => {
  const [name, setName] = useState(defaultName ?? '');
  const canSubmit = name.trim().length > 0 && !isSubmitting;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    onSubmit({ name: name.trim() });
  };

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-2">空间名称</label>
        <input
          className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-accent"
          placeholder="例如：默认项目"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-2xl bg-primary text-white text-sm font-semibold py-3 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-primary/20 transition-all flex items-center justify-center"
      >
        {isSubmitting ? <LoadingSpinner label="提交中..." /> : '确认修改'}
      </button>
    </form>
  );
};

export default RenameProjectForm;
