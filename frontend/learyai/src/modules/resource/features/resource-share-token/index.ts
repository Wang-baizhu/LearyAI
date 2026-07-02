// modules/resource/features/resource-share-token 对外统一出口，收敛 slice 间依赖路径。
export { resourceShareTokenApi } from './model/effects/api';
export type {
  ResourceShareDocRef,
  ResourceShareTokenPayload,
  ResourceShareTokenResult,
} from './model/effects/api';
export { default as ResourceShareTokenModal } from './ui/ResourceShareTokenModal';
