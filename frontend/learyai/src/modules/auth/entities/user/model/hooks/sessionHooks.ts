// entities/user/sessionHooks 提供基于 Redux 的用户会话访问与操作 hook。
import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { setSession } from '../store/userSlice';
import type { UserSession } from '../types';

export type { UserSession };

export const useUserSession = () => {
  const session = useAppSelector((state) => state.user.session);
  const dispatch = useAppDispatch();

  const updateSession = useCallback(
    (nextSession: UserSession | null) => {
      dispatch(setSession(nextSession));
    },
    [dispatch]
  );

  return { session, setSession: updateSession };
};

export const useCurrentUser = () => useAppSelector((state) => state.user.session);
