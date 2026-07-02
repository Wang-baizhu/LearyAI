// authApi.test.ts 负责验证认证 API 的请求参数、默认值与响应映射行为。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
}));

vi.mock('@/shared/api/client', () => ({
  apiRequest: mocks.apiRequest,
}));

import { authApi } from '../authApi';

describe('authApi', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('login 会使用默认 rememberMe 与 navigator.userAgent 作为 deviceId', async () => {
    vi.stubGlobal('navigator', { userAgent: 'Vitest-UA' });
    mocks.apiRequest.mockResolvedValue({
      data: {
        userId: 1,
        name: 'Leary',
        email: 'leary@example.com',
        phone: '13800000000',
        userMode: 'STANDARD',
      },
      message: '登录成功',
    });

    await expect(
      authApi.login({
        email: 'leary@example.com',
        password: 'secret',
      })
    ).resolves.toEqual({
      session: {
        id: 1,
        name: 'Leary',
        email: 'leary@example.com',
        phone: '13800000000',
        userMode: 'STANDARD',
      },
      message: '登录成功',
    });

    expect(mocks.apiRequest).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      body: {
        email: 'leary@example.com',
        password: 'secret',
        rememberMe: true,
        deviceId: 'Vitest-UA',
      },
    });
  });

  it('me 会请求当前登录态并映射 session', async () => {
    mocks.apiRequest.mockResolvedValue({
      data: {
        userId: 2,
        name: 'Case',
        email: 'case@example.com',
        phone: '13900000000',
        userMode: 'ADMIN',
      },
      message: 'ok',
    });

    await expect(authApi.me()).resolves.toEqual({
      session: {
        id: 2,
        name: 'Case',
        email: 'case@example.com',
        phone: '13900000000',
        userMode: 'ADMIN',
      },
      message: 'ok',
    });

    expect(mocks.apiRequest).toHaveBeenCalledWith('/auth/me', {
      method: 'GET',
    });
  });

  it('register 会补全空 phone/smsCode 与默认 deviceId', async () => {
    vi.stubGlobal('navigator', { userAgent: 'Web-Client-UA' });
    mocks.apiRequest.mockResolvedValue({
      data: {
        userId: 3,
        name: 'Register',
        email: 'register@example.com',
        phone: '',
        userMode: 'STANDARD',
      },
      message: '注册成功',
    });

    await expect(
      authApi.register({
        name: 'Register',
        email: 'register@example.com',
        password: 'secret',
      })
    ).resolves.toEqual({
      message: '注册成功',
    });

    expect(mocks.apiRequest).toHaveBeenCalledWith('/auth/register', {
      method: 'POST',
      body: {
        name: 'Register',
        email: 'register@example.com',
        password: 'secret',
        phone: '',
        smsCode: '',
        rememberMe: true,
        deviceId: 'Web-Client-UA',
      },
    });
  });

  it('registerWithInvite 会透传邀请码注册字段与默认 deviceId', async () => {
    vi.stubGlobal('navigator', { userAgent: 'Invite-UA' });
    mocks.apiRequest.mockResolvedValue({
      data: {
        userId: 4,
        name: 'Invite',
        email: 'invite@example.com',
        phone: '13800000009',
        userMode: 'STANDARD',
      },
      message: '邀请码注册成功',
    });

    await expect(
      authApi.registerWithInvite({
        name: 'Invite',
        email: 'invite@example.com',
        phone: '13800000009',
        password: 'secret',
        inviteCode: 'INVITE-001',
      })
    ).resolves.toEqual({
      message: '邀请码注册成功',
    });

    expect(mocks.apiRequest).toHaveBeenCalledWith('/auth/register/invite', {
      method: 'POST',
      body: {
        name: 'Invite',
        email: 'invite@example.com',
        phone: '13800000009',
        password: 'secret',
        inviteCode: 'INVITE-001',
        rememberMe: true,
        deviceId: 'Invite-UA',
      },
    });
  });

  it('sendVerificationCode / verifyCode / logout 会透传对应请求', async () => {
    mocks.apiRequest
      .mockResolvedValueOnce({ data: { code: '123456' }, message: '短信已发送' })
      .mockResolvedValueOnce({ data: {}, message: '验证通过' })
      .mockResolvedValueOnce({ data: {}, message: '已退出' });

    await expect(authApi.sendVerificationCode('13800000000')).resolves.toEqual({ message: '短信已发送' });
    await expect(authApi.verifyCode({ phone: '13800000000', code: '123456' })).resolves.toEqual({
      message: '验证通过',
    });
    await expect(authApi.logout()).resolves.toEqual({ message: '已退出' });

    expect(mocks.apiRequest).toHaveBeenNthCalledWith(1, '/auth/sms-code', {
      method: 'POST',
      body: { phone: '13800000000' },
    });
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(2, '/auth/sms-code/verify', {
      method: 'POST',
      body: { phone: '13800000000', code: '123456' },
    });
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(3, '/auth/logout', {
      method: 'POST',
    });
  });
});
