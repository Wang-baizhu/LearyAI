// modules/auth/features 对外统一出口，收敛 slice 间依赖路径。
export { authApi } from './api/authApi';
export type { LoginPayload, LoginResponse, RegisterInvitePayload, RegisterPayload, VerificationPayload } from './api/authApi';
export { VERIFICATION_CODE_LENGTH, VERIFICATION_COUNTDOWN_SECONDS } from './config/constants';
export { useAuthFeature } from './model/hooks/useAuthFeature';
export { default as LoginForm } from './ui/LoginForm';

export { default as RequireAuth } from './ui/RequireAuth';

export { default as RegisterForm } from './ui/RegisterForm';
export { default as InviteRegisterForm } from './ui/InviteRegisterForm';

export { default as VerificationForm } from './ui/VerificationForm';
