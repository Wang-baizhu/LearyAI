// capacitor.config.ts 负责定义 Leary AI 的 Capacitor 宿主配置。
import type { CapacitorConfig } from '@capacitor/cli';

// WARN: 仅用于调试阶段加载外部 dev server；移除后会回退到本地 dist，不代表最终发布形态。
const devServerUrl = process.env.CAP_SERVER_URL?.trim();

const config: CapacitorConfig = {
  appId: 'ai.leary.mobile',
  appName: 'Leary AI',
  webDir: 'dist',
  server: devServerUrl
    ? {
        url: devServerUrl,
        cleartext: devServerUrl.startsWith('http://'),
      }
    : undefined,
};

export default config;
