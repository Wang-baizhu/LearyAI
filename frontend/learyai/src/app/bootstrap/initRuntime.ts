// initRuntime 负责在 React 挂载前完成运行时初始化。
import { bootstrapCapacitorRuntime } from '@/app/runtime/capacitor/bootstrap';
import { applyRuntimePlatformAttributes } from '@/app/runtime/platform/env';
import { preloadCommonMaterialIcons } from '@/shared/lib/materialIconPreload';

export const initRuntime = async () => {
  applyRuntimePlatformAttributes();
  preloadCommonMaterialIcons();
  await bootstrapCapacitorRuntime();
};
