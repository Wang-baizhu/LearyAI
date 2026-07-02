// modules/auth/entities/user 对外统一出口，收敛 slice 间依赖路径。
export { default } from './model/store/userSlice';
export { useCurrentUser, useUserSession } from './model/hooks/sessionHooks';
export type { UserSession } from './model/hooks/sessionHooks';
export { default as userSlice } from './model/store/userSlice';
export { clearSession, setSession } from './model/store/userSlice';

