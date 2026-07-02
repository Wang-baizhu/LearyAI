// bootstrap 负责接入 Capacitor 宿主初始化与基础交互。
import { Capacitor } from '@capacitor/core';
import { KeyboardResize } from '@capacitor/keyboard';
import { Style } from '@capacitor/status-bar';
import { isNativeApp } from '@/app/runtime/platform/isNativeApp';
import { registerCapacitorBackButton } from './backButton';
import { capacitorRuntimePlugins } from './plugins';

let bootstrapPromise: Promise<void> | null = null;

const configureStatusBar = async () => {
  await capacitorRuntimePlugins.StatusBar.setOverlaysWebView({ overlay: false });
  await capacitorRuntimePlugins.StatusBar.setStyle({ style: Style.Default });
};

const configureKeyboard = async () => {
  if (Capacitor.getPlatform() !== 'ios') {
    return;
  }
  await capacitorRuntimePlugins.Keyboard.setResizeMode({ mode: KeyboardResize.Body });
  await capacitorRuntimePlugins.Keyboard.setScroll({ isDisabled: false });
};

const configureDocumentState = () => {
  document.body.classList.add('capacitor-ready');
};

const bootstrapNativeApp = async () => {
  await configureStatusBar();
  await configureKeyboard();
  await registerCapacitorBackButton(capacitorRuntimePlugins);
  configureDocumentState();
};

export const bootstrapCapacitorRuntime = async () => {
  if (!isNativeApp()) {
    return;
  }
  if (!bootstrapPromise) {
    bootstrapPromise = bootstrapNativeApp();
  }
  await bootstrapPromise;
};
