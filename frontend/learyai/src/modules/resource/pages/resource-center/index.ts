// modules/resource/pages/resource-center 对外统一出口，收敛 slice 间依赖路径。
export { default as useResourceCenterPageModel } from './model/useResourceCenterPageModel';

export { default as ResourceCenterLayout } from './ui/ResourceCenterLayout';
export type { ResourceCenterOutletContext } from './ui/ResourceCenterLayout';
export { default as ResourceCenterPage } from './ui/ResourceCenterPage';
