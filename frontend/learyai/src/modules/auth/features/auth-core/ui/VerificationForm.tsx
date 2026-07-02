// VerificationForm 负责验证码输入的展示，倒计时与发送操作通过 props 暴露。
import React, { useMemo, useRef, useState } from 'react';
import type { UseMutationResult } from '@tanstack/react-query';
import type { VerificationPayload } from '../api/authApi';
import { resolveApiErrorMessage } from '@/shared/api/resolveApiError';
import { VERIFICATION_CODE_LENGTH } from '../config/constants';
import InlineNotice from '@/shared/ui/InlineNotice';
import LoadingSpinner from '@/shared/ui/LoadingSpinner';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';

interface VerificationFormProps {
  mutation: UseMutationResult<{ message: string }, Error, VerificationPayload>;
  onSubmit: (payload: { phone: string; code: string }) => void;
  onBack: () => void;
  onRequestCode: (phone: string) => void;
  countdown: {
    remaining: number;
    isRunning: boolean;
  };
  sendCodeMutation?: UseMutationResult<{ message: string }, Error, string>;
}

const VerificationForm: React.FC<VerificationFormProps> = ({
  mutation,
  onSubmit,
  onBack,
  onRequestCode,
  countdown,
  sendCodeMutation,
}) => {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState<string[]>(new Array(VERIFICATION_CODE_LENGTH).fill(''));
  const inputRefs = useRef<HTMLInputElement[]>([]);

  const handleInputChange = (index: number, value: string) => {
    if (value.length > 1) {
      value = value.slice(-1);
    }
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    if (value && index < VERIFICATION_CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit({ phone, code: code.join('') });
  };

  const handleSendCode = () => {
    onRequestCode(phone);
  };

  const sendCodeNotice = (() => {
    if (!sendCodeMutation) {
      return '';
    }
    if (sendCodeMutation.isError) {
      return resolveApiErrorMessage(sendCodeMutation.error, '发送失败，请稍后再试');
    }
    if (sendCodeMutation.isSuccess) {
      return sendCodeMutation.data?.message ?? '验证码发送成功';
    }
    return '';
  })();

  const verifyNotice = useMemo(() => {
    if (mutation.isError) {
      return resolveApiErrorMessage(mutation.error, '注册失败，请稍后再试');
    }
    if (mutation.isSuccess) {
      return mutation.data?.message ?? '验证成功';
    }
    return '';
  }, [mutation.data?.message, mutation.error, mutation.isError, mutation.isSuccess]);

  const buttonLabel = countdown.isRunning ? `重新发送 (${countdown.remaining}s)` : '获取验证码';

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500 max-w-md mx-auto w-full">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">验证您的身份</h1>
      <p className="text-slate-500 dark:text-slate-400 mb-10">
        请输入您的手机号码以接收验证码，以确保账号安全。
      </p>

      <form className="space-y-8" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">手机号码</label>
          <div className="flex gap-2">
            <div className="relative min-w-[90px]">
              <select className="w-full bg-slate-50 dark:bg-[#1a1a1a] border-slate-200 dark:border-[#2a2a2a] rounded-xl px-3 py-3 text-slate-900 dark:text-[#e0e0e0] focus:ring-brand-teal focus:border-brand-teal appearance-none">
                <option>+86</option>
                <option>+852</option>
                <option>+1</option>
                <option>+44</option>
              </select>
            </div>
              <div className="relative flex-1">
              <input
                className="w-full bg-slate-50 dark:bg-[#1a1a1a] border-slate-200 dark:border-[#2a2a2a] rounded-xl px-4 py-3 text-slate-900 dark:text-[#e0e0e0] placeholder:text-slate-400 focus:ring-brand-teal focus:border-brand-teal outline-none transition-all"
                placeholder="138 0000 0000"
                type="tel"
                required
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>
            <button
            className="whitespace-nowrap px-4 py-3 bg-slate-100 dark:bg-[#1a1a1a] text-slate-700 dark:text-[#e0e0e0] font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-[#2a2a2a] transition-colors text-sm"
              type="button"
              onClick={handleSendCode}
              disabled={countdown.isRunning || !phone || sendCodeMutation?.isPending}
            >
              {buttonLabel}
            </button>
          </div>
          {sendCodeNotice && (
            <InlineNotice
              variant={sendCodeMutation?.isError ? 'error' : 'success'}
              message={sendCodeNotice}
            />
          )}
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">6 位验证码</label>
          <div className="flex justify-between gap-2">
            {code.map((val, index) => (
              <input
                key={index}
                ref={(el) => {
                  if (el) {
                    inputRefs.current[index] = el;
                  }
                }}
                type="text"
                maxLength={1}
                value={val}
                onChange={(event) => handleInputChange(index, event.target.value)}
                onKeyDown={(event) => handleKeyDown(index, event)}
                className="w-full h-14 text-center text-xl font-bold bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] rounded-xl focus:ring-2 focus:ring-brand-teal focus:border-transparent outline-none dark:text-[#e0e0e0] transition-all"
              />
            ))}
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">验证码在 5 分钟内有效。如未收到，请检查垃圾短信。</p>
        </div>

        {verifyNotice && (
          <InlineNotice
            variant={mutation.isError ? 'error' : 'success'}
            message={verifyNotice}
          />
        )}

        <button
          className="w-full bg-brand-teal hover:bg-teal-700 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-teal-500/20 active:scale-[0.98]"
          type="submit"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? <LoadingSpinner label="验证中..." /> : '验证并继续'}
          {!mutation.isPending && <MaterialIcon name="arrow_forward" />}
        </button>

        <div className="text-center">
          <button
            type="button"
            onClick={onBack}
            className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-brand-teal dark:hover:text-brand-teal transition-colors flex items-center justify-center gap-1 mx-auto"
          >
            <MaterialIcon name="arrow_back" className="text-sm" />
            返回登录
          </button>
        </div>
      </form>
    </div>
  );
};

export default VerificationForm;
