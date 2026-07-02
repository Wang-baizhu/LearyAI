// ProjectInviteJoinForm 负责通过邀请码加入项目的表单与提交。
import React, { useState } from 'react';
import { resolveApiErrorMessage } from '@/shared/api/resolveApiError';
import { useAppDispatch } from '@/app/store/hooks';
import { openDialog } from '@/app/store/ui/dialogSlice';
import LoadingSpinner from '@/shared/ui/LoadingSpinner';
import { useAcceptProjectInvite } from '../model/useAcceptProjectInvite';

interface ProjectInviteJoinFormProps {
  onAccepted?: () => void;
}

const ProjectInviteJoinForm: React.FC<ProjectInviteJoinFormProps> = ({ onAccepted }) => {
  const dispatch = useAppDispatch();
  const [inviteCode, setInviteCode] = useState('');
  const acceptInviteMutation = useAcceptProjectInvite();
  const isSubmitting = acceptInviteMutation.isPending;
  const canSubmit = inviteCode.trim().length > 0 && !isSubmitting;

  return (
    <form className="space-y-5">
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-2">邀请码</label>
        <input
          className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-accent"
          placeholder="请输入邀请码"
          value={inviteCode}
          onChange={(event) => setInviteCode(event.target.value)}
        />
      </div>
      <button
        type="button"
        disabled={!canSubmit}
        className="w-full rounded-2xl border border-primary text-primary text-sm font-semibold py-3 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/5 transition-all flex items-center justify-center"
        onClick={() => {
          if (!canSubmit) {
            return;
          }
          acceptInviteMutation.mutate(
            { inviteCode: inviteCode.trim() },
            {
              onSuccess: () => {
                dispatch(
                  openDialog({
                    type: 'notice',
                    payload: {
                      title: '提示',
                      message: '加入成功',
                    },
                  })
                );
                setInviteCode('');
                onAccepted?.();
              },
              onError: (error) => {
                const errorMessage = resolveApiErrorMessage(error, '加入失败，请稍后再试');
                dispatch(
                  openDialog({
                    type: 'error',
                    payload: {
                      title: '出错了',
                      message: errorMessage,
                    },
                  })
                );
              },
            }
          );
        }}
      >
        {isSubmitting ? <LoadingSpinner label="提交中..." /> : '加入'}
      </button>
    </form>
  );
};

export default ProjectInviteJoinForm;
