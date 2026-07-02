
// types 负责保存应用内的基础页面类型定义。
export type AuthView = 'login' | 'register' | 'verify' | 'registerInvite';

export interface AuthState {
  view: AuthView;
  darkMode: boolean;
}
