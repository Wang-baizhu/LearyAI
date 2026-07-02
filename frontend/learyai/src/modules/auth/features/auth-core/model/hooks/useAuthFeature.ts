// useAuthFeature 负责封装认证流程并提供 TanStack Query 状态给页面层。
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '../../api/authApi';
import type { LoginPayload, RegisterInvitePayload, RegisterPayload, VerificationPayload } from '../../api/authApi';
import { useCountdown } from '@/shared/hooks/useCountdown';
import { VERIFICATION_COUNTDOWN_SECONDS } from '../../config/constants';
import { useUserSession } from '../../../../entities/user';
import { useAppDispatch } from '@/app/store/hooks';
import { enqueueToast } from '@/app/store/ui/toastSlice';

export const useAuthFeature = () => {
  const { setSession } = useUserSession();
  const dispatch = useAppDispatch();
  const [pendingRegisterPayload, setPendingRegisterPayload] = useState<RegisterPayload | null>(null);
  const countdown = useCountdown(VERIFICATION_COUNTDOWN_SECONDS);

  const loginMutation = useMutation({
    mutationFn: (payload: LoginPayload) => authApi.login(payload),
    onSuccess: (response) => {
      setSession(response.session);
      dispatch(
        enqueueToast({
          variant: 'success',
          message: response.message ?? '登录成功',
        })
      );
    },
  });

  const prepareRegisterMutation = useMutation({
    mutationFn: async (payload: RegisterPayload) => ({
      payload,
      message: '请发送验证码并完成验证',
    }),
    onSuccess: (result) => {
      setPendingRegisterPayload(result.payload);
    },
  });

  const sendCodeMutation = useMutation({
    mutationFn: (phone: string) => authApi.sendVerificationCode(phone),
    onSuccess: () => {
      countdown.start();
    },
  });

  const registerWithInviteMutation = useMutation({
    mutationFn: (payload: RegisterInvitePayload) => authApi.registerWithInvite(payload),
    onSuccess: () => {
      dispatch(
        enqueueToast({
          variant: 'success',
          message: '注册成功',
        })
      );
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async (payload: VerificationPayload) => {
      if (!pendingRegisterPayload) {
        throw new Error('请先填写邮箱和密码再继续');
      }
      return authApi.register({
        ...pendingRegisterPayload,
        phone: payload.phone,
        smsCode: payload.code,
      });
    },
    onSuccess: () => {
      setPendingRegisterPayload(null);
      dispatch(
        enqueueToast({
          variant: 'success',
          message: '注册成功',
        })
      );
    },
  });

  return {
    countdown,
    loginMutation,
    prepareRegisterMutation,
    registerWithInviteMutation,
    sendCodeMutation,
    verifyMutation,
  };
};
