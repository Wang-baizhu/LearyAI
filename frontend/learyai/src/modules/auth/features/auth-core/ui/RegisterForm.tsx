// RegisterForm 仅实现注册表单呈现与字段收集，业务反馈通过外部 props 传入。
import React, { useMemo, useState } from 'react';
import type { UseMutationResult } from '@tanstack/react-query';
import type { RegisterPayload } from '../api/authApi';
import { resolveApiErrorMessage } from '@/shared/api/resolveApiError';
import LoadingSpinner from '@/shared/ui/LoadingSpinner';
import InlineNotice from '@/shared/ui/InlineNotice';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';

interface RegisterFormProps {
  mutation: UseMutationResult<{ payload: RegisterPayload; message: string }, Error, RegisterPayload>;
  onSubmit: (payload: { name: string; email: string; password: string }) => void;
  onSwitch: () => void;
  onInviteSwitch: () => void;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ mutation, onSubmit, onSwitch, onInviteSwitch }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const isLoading = mutation.isPending;
  const noticeMessage = useMemo(() => {
    if (mutation.isError) {
      return resolveApiErrorMessage(mutation.error, '注册失败，请稍后再试');
    }
    if (mutation.isSuccess) {
      return '注册成功';
    }
    return '';
  }, [mutation.error, mutation.isError, mutation.isSuccess]);

  const passwordTooltip = useMemo(() => '至少 8 个字符，且包含一个数字或特殊符号。', []);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit({ name, email, password });
  };

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="mb-10 text-center lg:text-left">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">创建您的账号</h2>
        <p className="text-slate-500 dark:text-slate-400">加入下一代高级用户，体验智能工作流。</p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2" htmlFor="name">
            昵称
          </label>
          <input
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a] text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
            id="name"
            placeholder="不超过 10 个字"
            type="text"
            required
            maxLength={10}
            disabled={isLoading}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2" htmlFor="email">
            工作邮箱
          </label>
          <input
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a] text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
            id="email"
            placeholder="alex@company.ai"
            type="email"
            required
            disabled={isLoading}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2" htmlFor="password">
            密码
          </label>
          <div className="relative">
            <input
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a] text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none pr-12"
              id="password"
              placeholder="••••••••"
              type={showPassword ? 'text' : 'password'}
              required
              disabled={isLoading}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <MaterialIcon
                name={showPassword ? 'visibility_off' : 'visibility'}
                className="text-xl"
              />
            </button>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">{passwordTooltip}</p>
        </div>

        <div className="flex items-start gap-3">
          <div className="flex items-center h-5">
            <input
            className="w-4 h-4 rounded border-slate-300 dark:border-[#2a2a2a] text-brand-teal focus:ring-brand-teal bg-white dark:bg-[#1a1a1a]"
              id="terms"
              type="checkbox"
              required
              disabled={isLoading}
            />
          </div>
          <label className="text-sm text-slate-500 dark:text-slate-400" htmlFor="terms">
            我同意
            <a className="text-brand-teal hover:underline font-medium px-1" href="#">
              服务条款
            </a>
            与
            <a className="text-brand-teal hover:underline font-medium px-1" href="#">
              隐私政策
            </a>
            。
          </label>
        </div>

        <button
          className="w-full py-4 px-6 bg-brand-teal hover:bg-teal-700 text-white font-bold rounded-xl shadow-lg shadow-teal-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        type="submit"
        disabled={isLoading}
      >
        {isLoading ? <LoadingSpinner label="提交中..." /> : '创建账号'}
        {!isLoading && <MaterialIcon name="arrow_forward" />}
      </button>

        {noticeMessage && (
          <InlineNotice
            variant={mutation.isError ? 'error' : 'success'}
            message={noticeMessage}
          />
        )}

        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-8">
          已有账号？
          <button
            type="button"
            onClick={onSwitch}
            className="ml-1 text-brand-teal font-bold hover:underline"
            disabled={isLoading}
          >
            立即登录
          </button>
        </p>

        <div className="text-center">
          <button
            type="button"
            onClick={onInviteSwitch}
            className="text-xs font-medium text-slate-400 dark:text-slate-500 hover:text-brand-teal transition-colors"
            disabled={isLoading}
          >
            邀请码注册
          </button>
        </div>
      </form>
    </div>
  );
};

export default RegisterForm;
