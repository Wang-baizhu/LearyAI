// plugins 负责集中加载 Capacitor 原生插件。
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Keyboard } from '@capacitor/keyboard';
import { StatusBar } from '@capacitor/status-bar';

export interface CapacitorRuntimePlugins {
  App: typeof App;
  Browser: typeof Browser;
  Keyboard: typeof Keyboard;
  StatusBar: typeof StatusBar;
}

export const capacitorRuntimePlugins: CapacitorRuntimePlugins = {
  App,
  Browser,
  Keyboard,
  StatusBar,
};
