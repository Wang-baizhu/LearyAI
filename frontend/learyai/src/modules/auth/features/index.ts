// modules/auth/features 对外统一出口，收敛 slice 间依赖路径。
export { authApi, InviteRegisterForm, LoginForm, RegisterForm, RequireAuth, useAuthFeature, VERIFICATION_CODE_LENGTH, VERIFICATION_COUNTDOWN_SECONDS, VerificationForm } from './auth-core';
export type { LoginPayload, LoginResponse, RegisterInvitePayload, RegisterPayload, VerificationPayload } from './auth-core';
