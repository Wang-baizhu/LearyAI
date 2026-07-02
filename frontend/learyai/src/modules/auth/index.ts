// modules/auth 作为认证模块统一出口，收敛跨模块依赖引用。
export { default as AuthPage, ElectronAuthCompletePage } from './pages';
export { authApi, useAuthFeature } from './features';
export type { LoginPayload, RegisterPayload, VerificationPayload, LoginResponse } from './features';
export { useUserSession, useCurrentUser, default as userReducer } from './entities/user';
export type { UserSession } from './entities/user';
export { RequireAuth } from './features';
