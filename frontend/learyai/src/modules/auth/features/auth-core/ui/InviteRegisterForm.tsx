// InviteRegisterForm 仅实现邀请码注册表单呈现与字段收集，业务反馈通过外部 props 传入。
import React, { useMemo, useState } from 'react';
import type { UseMutationResult } from '@tanstack/react-query';
import type { RegisterInvitePayload } from '../api/authApi';
import { resolveApiErrorMessage } from '@/shared/api/resolveApiError';
import LoadingSpinner from '@/shared/ui/LoadingSpinner';
import InlineNotice from '@/shared/ui/InlineNotice';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';

interface InviteRegisterFormProps {
  mutation: UseMutationResult<{ message: string }, Error, RegisterInvitePayload>;
  onSubmit: (payload: RegisterInvitePayload) => void;
  onSwitchLogin: () => void;
  onSwitchSmsRegister: () => void;
}

const InviteRegisterForm: React.FC<InviteRegisterFormProps> = ({
  mutation,
  onSubmit,
  onSwitchLogin,
  onSwitchSmsRegister,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const isLoading = mutation.isPending;
  const noticeMessage = useMemo(() => {
    if (mutation.isError) {
      return resolveApiErrorMessage(mutation.error, '邀请码注册失败，请稍后再试');
    }
    if (mutation.isSuccess) {
      return mutation.data?.message ?? '注册成功';
    }
    return '';
  }, [mutation.data?.message, mutation.error, mutation.isError, mutation.isSuccess]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit({
      name,
      email,
      phone,
      password,
      inviteCode,
    });
  };

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="mb-10 text-center lg:text-left">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">使用邀请码创建账号</h2>
        <p className="text-slate-500 dark:text-slate-400">输入有效邀请码后可直接完成注册，无需短信验证。</p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2" htmlFor="invite-name">
            昵称
          </label>
          <input
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a] text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
            id="invite-name"
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
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2" htmlFor="invite-email">
            工作邮箱
          </label>
          <input
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a] text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
            id="invite-email"
            placeholder="alex@company.ai"
            type="email"
            required
            disabled={isLoading}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2" htmlFor="invite-phone">
            手机号码
          </label>
          <input
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a] text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
            id="invite-phone"
            placeholder="138 0000 0000"
            type="tel"
            required
            disabled={isLoading}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2" htmlFor="invite-password">
            密码
          </label>
          <div className="relative">
            <input
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a] text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none pr-12"
              id="invite-password"
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
              <MaterialIcon name={showPassword ? 'visibility_off' : 'visibility'} className="text-xl" />
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2" htmlFor="invite-code">
            邀请码
          </label>
          <input
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a] text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none uppercase tracking-[0.2em] font-mono"
            id="invite-code"
            placeholder="输入邀请码"
            type="text"
            required
            disabled={isLoading}
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
          />
        </div>

        <button
          className="w-full py-4 px-6 bg-brand-teal hover:bg-teal-700 text-white font-bold rounded-xl shadow-lg shadow-teal-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? <LoadingSpinner label="提交中..." /> : '立即注册'}
          {!isLoading && <MaterialIcon name="verified" />}
        </button>

        {noticeMessage && (
          <InlineNotice
            variant={mutation.isError ? 'error' : 'success'}
            message={noticeMessage}
          />
        )}

        <div className="flex items-center justify-between gap-3 text-sm">
          <button
            type="button"
            onClick={onSwitchSmsRegister}
            className="text-slate-500 dark:text-slate-400 hover:text-brand-teal transition-colors"
            disabled={isLoading}
          >
            短信验证注册
          </button>
          <button
            type="button"
            onClick={onSwitchLogin}
            className="text-brand-teal font-bold hover:underline"
            disabled={isLoading}
          >
            返回登录
          </button>
        </div>
      </form>
    </div>
  );
};

export default InviteRegisterForm;
