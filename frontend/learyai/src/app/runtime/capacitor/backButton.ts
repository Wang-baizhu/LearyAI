// backButton 负责注册 Android 返回键行为。
import type { PluginListenerHandle } from '@capacitor/core';
import type { CapacitorRuntimePlugins } from './plugins';

export const registerCapacitorBackButton = (
  plugins: CapacitorRuntimePlugins,
): Promise<PluginListenerHandle> =>
  plugins.App.addListener('backButton', () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    if (window.location.pathname !== '/') {
      window.location.assign('/');
      return;
    }

    void plugins.App.exitApp();
  });
