// env 负责收口应用运行平台判断与宿主标记写入。
import { Capacitor } from '@capacitor/core';
import { isNativeApp } from './isNativeApp';

export type RuntimePlatform = 'web' | 'capacitor';

export const getRuntimePlatform = (): RuntimePlatform => (isNativeApp() ? 'capacitor' : 'web');

export const getRuntimePlatformLabel = () => {
  if (!isNativeApp()) {
    return 'web';
  }
  return `capacitor:${Capacitor.getPlatform()}`;
};

export const applyRuntimePlatformAttributes = () => {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  const runtimePlatform = getRuntimePlatform();
  root.dataset.runtimePlatform = runtimePlatform;
  root.dataset.runtimeHost = getRuntimePlatformLabel();
  root.classList.toggle('native-app', runtimePlatform === 'capacitor');
};
