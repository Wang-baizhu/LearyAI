// useAuthFeature.test.ts 负责验证认证流程 hook 的 mutation 配置与成功回调行为。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useState: vi.fn(),
  useMutation: vi.fn((options) => options),
  useCountdown: vi.fn(),
  useUserSession: vi.fn(),
  useAppDispatch: vi.fn(),
  enqueueToast: vi.fn((payload) => ({ type: 'toast/enqueue', payload })),
  login: vi.fn(),
  register: vi.fn(),
  registerWithInvite: vi.fn(),
  sendVerificationCode: vi.fn(),
  setSession: vi.fn(),
  setPendingRegisterPayload: vi.fn(),
  countdownStart: vi.fn(),
  dispatch: vi.fn(),
}));

vi.mock('react', () => ({
  useState: mocks.useState,
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: mocks.useMutation,
}));

vi.mock('@/shared/hooks/useCountdown', () => ({
  useCountdown: mocks.useCountdown,
}));

vi.mock('../../../../../entities/user', () => ({
  useUserSession: mocks.useUserSession,
}));

vi.mock('@/app/store/hooks', () => ({
  useAppDispatch: mocks.useAppDispatch,
  useAppSelector: vi.fn(),
}));

vi.mock('@/app/store/ui/toastSlice', () => ({
  enqueueToast: mocks.enqueueToast,
}));

vi.mock('../../../api/authApi', () => ({
  authApi: {
    login: mocks.login,
    register: mocks.register,
    registerWithInvite: mocks.registerWithInvite,
    sendVerificationCode: mocks.sendVerificationCode,
  },
}));

import { useAuthFeature } from '../useAuthFeature';

describe('useAuthFeature', () => {
  beforeEach(() => {
    mocks.useState.mockReset();
    mocks.useMutation.mockReset();
    mocks.useMutation.mockImplementation((options) => options);
    mocks.useCountdown.mockReset();
    mocks.useCountdown.mockReturnValue({ start: mocks.countdownStart, remainingSeconds: 60 });
    mocks.useUserSession.mockReset();
    mocks.useUserSession.mockReturnValue({ setSession: mocks.setSession });
    mocks.useAppDispatch.mockReset();
    mocks.useAppDispatch.mockReturnValue(mocks.dispatch);
    mocks.enqueueToast.mockClear();
    mocks.login.mockReset();
    mocks.register.mockReset();
    mocks.registerWithInvite.mockReset();
    mocks.sendVerificationCode.mockReset();
    mocks.setSession.mockReset();
    mocks.setPendingRegisterPayload.mockReset();
    mocks.countdownStart.mockReset();
    mocks.dispatch.mockReset();
  });

  it('登录成功后会写入 session 并派发成功 toast', () => {
    mocks.useState.mockReturnValue([null, mocks.setPendingRegisterPayload]);

    useAuthFeature();
    const loginMutationOptions = mocks.useMutation.mock.calls[0][0];
    loginMutationOptions.onSuccess?.({
      session: { id: 1, name: 'Leary' },
      message: '登录成功',
    });

    expect(mocks.setSession).toHaveBeenCalledWith({ id: 1, name: 'Leary' });
    expect(mocks.dispatch).toHaveBeenCalledWith({
      type: 'toast/enqueue',
      payload: {
        variant: 'success',
        message: '登录成功',
      },
    });
  });

  it('登录 mutationFn 会委托给 authApi.login', async () => {
    mocks.useState.mockReturnValue([null, mocks.setPendingRegisterPayload]);
    mocks.login.mockResolvedValue({
      session: { id: 1, name: 'Leary' },
      message: '登录成功',
    });

    useAuthFeature();
    const loginMutationOptions = mocks.useMutation.mock.calls[0][0];

    await expect(
      loginMutationOptions.mutationFn({
        email: 'leary@example.com',
        password: 'secret',
      })
    ).resolves.toEqual({
      session: { id: 1, name: 'Leary' },
      message: '登录成功',
    });
    expect(mocks.login).toHaveBeenCalledWith({
      email: 'leary@example.com',
      password: 'secret',
    });
  });

  it('prepareRegister 成功后会缓存待注册 payload', () => {
    mocks.useState.mockReturnValue([null, mocks.setPendingRegisterPayload]);

    useAuthFeature();
    const prepareRegisterMutationOptions = mocks.useMutation.mock.calls[1][0];
    prepareRegisterMutationOptions.onSuccess?.({
      payload: {
        name: 'Case',
        email: 'case@example.com',
        password: 'secret',
      },
      message: '请发送验证码并完成验证',
    });

    expect(mocks.setPendingRegisterPayload).toHaveBeenCalledWith({
      name: 'Case',
      email: 'case@example.com',
      password: 'secret',
    });
  });

  it('prepareRegister mutationFn 会返回原 payload 与固定提示文案', async () => {
    mocks.useState.mockReturnValue([null, mocks.setPendingRegisterPayload]);

    useAuthFeature();
    const prepareRegisterMutationOptions = mocks.useMutation.mock.calls[1][0];

    await expect(
      prepareRegisterMutationOptions.mutationFn({
        name: 'Case',
        email: 'case@example.com',
        password: 'secret',
      })
    ).resolves.toEqual({
      payload: {
        name: 'Case',
        email: 'case@example.com',
        password: 'secret',
      },
      message: '请发送验证码并完成验证',
    });
  });

  it('发送验证码成功后会启动倒计时', () => {
    mocks.useState.mockReturnValue([null, mocks.setPendingRegisterPayload]);

    useAuthFeature();
    const sendCodeMutationOptions = mocks.useMutation.mock.calls[2][0];
    sendCodeMutationOptions.onSuccess?.({ message: '短信已发送' });

    expect(mocks.countdownStart).toHaveBeenCalled();
  });

  it('发送验证码 mutationFn 会委托给 authApi.sendVerificationCode', async () => {
    mocks.useState.mockReturnValue([null, mocks.setPendingRegisterPayload]);
    mocks.sendVerificationCode.mockResolvedValue({ message: '短信已发送' });

    useAuthFeature();
    const sendCodeMutationOptions = mocks.useMutation.mock.calls[2][0];

    await expect(sendCodeMutationOptions.mutationFn('13800000000')).resolves.toEqual({
      message: '短信已发送',
    });
    expect(mocks.sendVerificationCode).toHaveBeenCalledWith('13800000000');
  });

  it('verifyMutation 在未准备注册信息时会直接抛错', async () => {
    mocks.useState.mockReturnValue([null, mocks.setPendingRegisterPayload]);

    useAuthFeature();
    const verifyMutationOptions = mocks.useMutation.mock.calls[4][0];

    await expect(
      verifyMutationOptions.mutationFn({
        phone: '13800000000',
        code: '123456',
      })
    ).rejects.toThrow('请先填写邮箱和密码再继续');
  });

  it('verifyMutation 会把缓存的注册信息与验证码合并提交，并在成功后清空缓存', async () => {
    mocks.useState.mockReturnValue([
      {
        name: 'Case',
        email: 'case@example.com',
        password: 'secret',
      },
      mocks.setPendingRegisterPayload,
    ]);
    mocks.register.mockResolvedValue({ message: '注册成功' });

    useAuthFeature();
    const verifyMutationOptions = mocks.useMutation.mock.calls[4][0];

    await expect(
      verifyMutationOptions.mutationFn({
        phone: '13800000000',
        code: '123456',
      })
    ).resolves.toEqual({ message: '注册成功' });
    expect(mocks.register).toHaveBeenCalledWith({
      name: 'Case',
      email: 'case@example.com',
      password: 'secret',
      phone: '13800000000',
      smsCode: '123456',
    });

    verifyMutationOptions.onSuccess?.({ message: '注册成功' });

    expect(mocks.setPendingRegisterPayload).toHaveBeenCalledWith(null);
    expect(mocks.dispatch).toHaveBeenCalledWith({
      type: 'toast/enqueue',
      payload: {
        variant: 'success',
        message: '注册成功',
      },
    });
  });

  it('registerWithInvite mutationFn 会委托给 authApi.registerWithInvite，并在成功后派发 toast', async () => {
    mocks.useState.mockReturnValue([null, mocks.setPendingRegisterPayload]);
    mocks.registerWithInvite.mockResolvedValue({ message: '邀请码注册成功' });

    useAuthFeature();
    const registerWithInviteMutationOptions = mocks.useMutation.mock.calls[3][0];

    await expect(
      registerWithInviteMutationOptions.mutationFn({
        name: 'Invite',
        email: 'invite@example.com',
        phone: '13800000009',
        password: 'secret',
        inviteCode: 'INVITE-001',
      })
    ).resolves.toEqual({ message: '邀请码注册成功' });
    expect(mocks.registerWithInvite).toHaveBeenCalledWith({
      name: 'Invite',
      email: 'invite@example.com',
      phone: '13800000009',
      password: 'secret',
      inviteCode: 'INVITE-001',
    });

    registerWithInviteMutationOptions.onSuccess?.({ message: '邀请码注册成功' });

    expect(mocks.dispatch).toHaveBeenCalledWith({
      type: 'toast/enqueue',
      payload: {
        variant: 'success',
        message: '注册成功',
      },
    });
  });
});
