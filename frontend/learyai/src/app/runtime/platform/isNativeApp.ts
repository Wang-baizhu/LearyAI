// isNativeApp 负责识别当前是否运行在 Capacitor 原生容器中。
import { Capacitor } from '@capacitor/core';

export const isNativeApp = () => Capacitor.isNativePlatform();
