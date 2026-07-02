// modules/auth/shared 作为模块内共享能力出口，收敛跨 slice 引用路径。
export { Layout } from './ui';
export type { AuthView } from './types';
export {
  DEFAULT_POST_AUTH_REDIRECT,
  buildLoginRedirectPath,
  resolveAuthRedirectTarget,
} from './lib/redirect';
