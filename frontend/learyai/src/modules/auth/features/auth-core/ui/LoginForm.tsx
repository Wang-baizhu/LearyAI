// LoginForm 仅负责登录表单的 presentation，所有请求状态通过 props 传入。
import React, { useMemo, useState } from 'react';
import type { UseMutationResult } from '@tanstack/react-query';
import type { LoginPayload, LoginResponse } from '../api/authApi';
import { resolveApiErrorMessage } from '@/shared/api/resolveApiError';
import LoadingSpinner from '@/shared/ui/LoadingSpinner';
import InlineNotice from '@/shared/ui/InlineNotice';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';

interface LoginFormProps {
  mutation: UseMutationResult<LoginResponse, Error, LoginPayload>;
  onSubmit: (payload: LoginPayload) => void;
  onSwitch: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ mutation, onSubmit, onSwitch }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit({ email, password, rememberMe });
  };

  const isLoading = mutation.isPending;
  const noticeMessage = useMemo(() => {
    if (mutation.isError) {
      return resolveApiErrorMessage(mutation.error, '登录失败，请稍后重试');
    }
    if (mutation.isSuccess) {
      return mutation.data?.message ?? '登录成功';
    }
    return '';
  }, [mutation.data?.message, mutation.error, mutation.isError, mutation.isSuccess]);

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="mb-10 text-center lg:text-left">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">欢迎回来</h1>
        <p className="text-slate-500 dark:text-slate-400">进入你的高级用户工作区与 AI 资源。</p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2" htmlFor="email">
            电子邮箱
          </label>
          <input
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a] text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
            id="email"
            placeholder="name@company.com"
            type="email"
            required
            disabled={isLoading}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="password">
              密码
            </label>
            <a className="text-sm font-semibold text-brand-teal hover:opacity-80 transition-opacity" href="#">
              忘记密码？
            </a>
          </div>
          <input
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a] text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
            id="password"
            placeholder="••••••••"
            type="password"
            required
            disabled={isLoading}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        <div className="flex items-center">
          <input
            className="w-4 h-4 text-brand-teal border-slate-300 rounded focus:ring-brand-teal bg-white dark:bg-[#1a1a1a]"
            id="remember"
            type="checkbox"
            disabled={isLoading}
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
          />
          <label className="ml-2 block text-sm text-slate-600 dark:text-slate-400" htmlFor="remember">
            保持登录 7 天
          </label>
        </div>

        <button
          className="w-full py-4 bg-brand-teal hover:bg-teal-700 text-white font-bold rounded-xl shadow-lg shadow-teal-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? <LoadingSpinner label="登录中..." /> : '登录'}
          {!isLoading && <MaterialIcon name="arrow_forward" className="text-lg" />}
        </button>

        {noticeMessage && (
          <InlineNotice
            variant={mutation.isError ? 'error' : 'success'}
            message={noticeMessage}
          />
        )}
      </form>

      <div className="relative my-10">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-panel-light dark:bg-[#1a1a1a] text-slate-500 dark:text-[#a0a0a0]">或者使用其他方式</span>
        </div>
      </div>

      <p className="text-center text-sm text-slate-500 dark:text-slate-400">
        还没有账号？
        <button
          onClick={onSwitch}
          className="ml-1 font-bold text-brand-teal hover:underline"
          type="button"
          disabled={isLoading}
        >
          立即注册
        </button>
      </p>
    </div>
  );
};

export default LoginForm;
