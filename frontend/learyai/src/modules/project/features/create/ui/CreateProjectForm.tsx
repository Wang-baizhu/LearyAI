// CreateProjectForm 负责新建空间表单的输入与提交。
import React, { useEffect, useState } from 'react';
import type { UseMutationResult } from '@tanstack/react-query';
import type { Project } from '../../../entities';
import type { ProjectCreatePayload } from '../api/projectCreateApi';
import { resolveApiErrorMessage } from '@/shared/api/resolveApiError';
import { useAppDispatch } from '@/app/store/hooks';
import { openDialog } from '@/app/store/ui/dialogSlice';
import { enqueueToast } from '@/app/store/ui/toastSlice';
import LoadingSpinner from '@/shared/ui/LoadingSpinner';

interface CreateProjectFormProps {
  mutation: UseMutationResult<{ item: Project; message: string }, Error, ProjectCreatePayload>;
  onSubmit: (payload: ProjectCreatePayload) => void;
}

const CreateProjectForm: React.FC<CreateProjectFormProps> = ({ mutation, onSubmit }) => {
  const dispatch = useAppDispatch();
  const [name, setName] = useState('');
  const isSubmitting = mutation.isPending;
  const canSubmit = name.trim().length > 0 && !isSubmitting;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    const payload = { name: name.trim() };
    setName('');
    onSubmit(payload);
  };

  useEffect(() => {
    if (mutation.isSuccess) {
      dispatch(
        enqueueToast({
          variant: 'success',
          message: '创建空间成功',
        })
      );
    } else if (mutation.isError) {
      const errorMessage = resolveApiErrorMessage(mutation.error, '创建空间失败，请稍后再试');
      dispatch(
        openDialog({
          type: 'error',
          payload: {
            title: '出错了',
            message: errorMessage,
          },
        })
      );
    }
  }, [dispatch, mutation.error, mutation.isError, mutation.isSuccess]);

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-2">空间名称</label>
        <input
          className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-accent"
          placeholder="例如：个人项目空间"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-2xl bg-primary text-white text-sm font-semibold py-3 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-primary/20 transition-all flex items-center justify-center"
      >
        {isSubmitting ? <LoadingSpinner label="提交中..." /> : '创建空间'}
      </button>
    </form>
  );
};

export default CreateProjectForm;
