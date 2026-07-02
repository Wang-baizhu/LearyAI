import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveApiErrorMessage: vi.fn((error: unknown, fallback: string) => {
    const message = error instanceof Error ? error.message : String(error);
    return `${fallback} :: ${message}`;
  }),
}));

vi.mock('@/shared/api/resolveApiError', () => ({
  resolveApiErrorMessage: mocks.resolveApiErrorMessage,
}));

vi.mock('@/shared/ui/LoadingSpinner', () => ({
  default: ({ label = '加载中...' }: { label?: string }) => (
    <span data-testid="spinner">{label}</span>
  ),
}));

vi.mock('@/shared/ui/InlineNotice', () => ({
  default: ({ variant = 'info', message }: { variant?: string; message: string }) => (
    <div data-testid="notice" data-variant={variant}>
      {message}
    </div>
  ),
}));

vi.mock('@/shared/ui/icons/MaterialIcon', () => ({
  default: ({ name }: { name: string }) => <i data-testid="icon" data-icon={name} />,
}));

import LoginForm from '../LoginForm';
import InviteRegisterForm from '../InviteRegisterForm';
import RegisterForm from '../RegisterForm';
import VerificationForm from '../VerificationForm';

const createMutation = <TData,>(overrides: Partial<Record<string, unknown>> = {}) =>
  ({
    data: undefined,
    error: undefined,
    isError: false,
    isPending: false,
    isSuccess: false,
    ...overrides,
  } as {
    data?: TData;
    error?: Error;
    isError: boolean;
    isPending: boolean;
    isSuccess: boolean;
  } & Record<string, unknown>);

describe('auth ui forms', () => {
  it('LoginForm 会渲染登录文案并展示成功状态提示', () => {
    const html = renderToStaticMarkup(
      <LoginForm
        mutation={createMutation({
          isSuccess: true,
          data: { message: '登录成功，欢迎回来' },
        }) as never}
        onSubmit={vi.fn()}
        onSwitch={vi.fn()}
      />
    );

    expect(html).toContain('欢迎回来');
    expect(html).toContain('进入你的高级用户工作区与 AI 资源。');
    expect(html).toContain('保持登录 7 天');
    expect(html).toContain('登录成功，欢迎回来');
    expect(html).toContain('立即注册');
  });

  it('RegisterForm 会渲染注册文案并展示错误状态提示', () => {
    const html = renderToStaticMarkup(
      <RegisterForm
        mutation={createMutation({
          isError: true,
          error: new Error('network-down'),
        }) as never}
        onSubmit={vi.fn()}
        onSwitch={vi.fn()}
        onInviteSwitch={vi.fn()}
      />
    );

    expect(html).toContain('创建您的账号');
    expect(html).toContain('加入下一代高级用户，体验智能工作流。');
    expect(html).toContain('至少 8 个字符，且包含一个数字或特殊符号。');
    expect(html).toContain('注册失败，请稍后再试 :: network-down');
    expect(html).toContain('立即登录');
    expect(html).toContain('邀请码注册');
  });

  it('InviteRegisterForm 会渲染邀请码注册文案并展示成功提示', () => {
    const html = renderToStaticMarkup(
      <InviteRegisterForm
        mutation={createMutation({
          isSuccess: true,
          data: { message: '邀请码注册成功' },
        }) as never}
        onSubmit={vi.fn()}
        onSwitchLogin={vi.fn()}
        onSwitchSmsRegister={vi.fn()}
      />
    );

    expect(html).toContain('使用邀请码创建账号');
    expect(html).toContain('输入有效邀请码后可直接完成注册，无需短信验证。');
    expect(html).toContain('邀请码注册成功');
    expect(html).toContain('短信验证注册');
  });

  it('VerificationForm 会渲染验证码流程并展示发送成功与提交中状态', () => {
    const html = renderToStaticMarkup(
      <VerificationForm
        mutation={createMutation({
          isPending: true,
        }) as never}
        sendCodeMutation={createMutation({
          isSuccess: true,
          data: { message: '验证码已发送' },
        }) as never}
        countdown={{ remaining: 12, isRunning: true }}
        onSubmit={vi.fn()}
        onBack={vi.fn()}
        onRequestCode={vi.fn()}
      />
    );

    expect(html).toContain('验证您的身份');
    expect(html).toContain('请输入您的手机号码以接收验证码，以确保账号安全。');
    expect(html).toContain('重新发送 (12s)');
    expect(html).toContain('验证码已发送');
    expect(html).toContain('验证中...');
    expect(html).toContain('返回登录');
  });
});
