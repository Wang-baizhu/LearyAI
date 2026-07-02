// 责任：定义管理端 Vite 构建与开发代理配置。
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const proxyTarget = env.VITE_PROXY_TARGET || 'http://127.0.0.1:8080';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: Number(env.VITE_PORT || 3000),
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          ws: false,
        },
      },
    },
  };
});
