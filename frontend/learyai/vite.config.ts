// 该文件负责 Vite 开发服务器与代理的基础配置。
import { defineConfig, loadEnv } from 'vite'
import path from 'node:path'
import react from '@vitejs/plugin-react'

const resolveProxyTarget = (
  value: string | undefined,
  fallback: string
): string => {
  const normalized = value?.trim()
  return normalized && normalized.length > 0 ? normalized : fallback
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '')
  const textEditablePackageEntry = path.resolve(
    __dirname,
    'packages/infra/text-editable/index.ts'
  )
  const uiPackageEntry = path.resolve(
    __dirname,
    'packages/ui/index.ts'
  )
  const templatePluginSdkCoreEntry = path.resolve(
    __dirname,
    'packages/template/plugin-sdk-core/index.ts'
  )
  const templatePluginSdkHostEntry = path.resolve(
    __dirname,
    'packages/template/plugin-sdk-host/index.ts'
  )
  const templatePptRuntimeEntry = path.resolve(
    __dirname,
    'packages/template/ppt-runtime/index.ts'
  )
  const templatePluginSdkReactEntry = path.resolve(
    __dirname,
    'packages/template/plugin-sdk-react/index.ts'
  )
  const templatePluginSdkReactContentEntry = path.resolve(
    __dirname,
    'packages/template/plugin-sdk-react/content.ts'
  )
  const apiTarget = resolveProxyTarget(
    env.VITE_PROXY_API_TARGET,
    'http://localhost:8080'
  )
  const sseTarget = resolveProxyTarget(
    env.VITE_PROXY_SSE_TARGET,
    apiTarget
  )
  const agentWsTarget = resolveProxyTarget(
    env.VITE_PROXY_AGENT_WS_TARGET,
    'ws://localhost:8081'
  )

  return {
    plugins: [react()],
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: [
        { find: /^react$/, replacement: path.resolve(__dirname, 'node_modules/react/index.js') },
        { find: /^react-dom$/, replacement: path.resolve(__dirname, 'node_modules/react-dom/index.js') },
        { find: '@leary/text-editable', replacement: textEditablePackageEntry },
        { find: '@leary/ui', replacement: uiPackageEntry },
        { find: '@leary/template-plugin-sdk-core', replacement: templatePluginSdkCoreEntry },
        { find: '@leary/template-plugin-sdk-host', replacement: templatePluginSdkHostEntry },
        { find: '@leary/template-ppt-runtime', replacement: templatePptRuntimeEntry },
        {
          find: '@leary/template-plugin-sdk-react/content',
          replacement: templatePluginSdkReactContentEntry,
        },
        { find: '@leary/template-plugin-sdk-react', replacement: templatePluginSdkReactEntry },
        { find: '@', replacement: path.resolve(__dirname, 'src') },
        { find: '@templates', replacement: path.resolve(__dirname, 'src/modules/template') },
      ],
    },
    test: {
      alias: [
        { find: /^react$/, replacement: path.resolve(__dirname, 'node_modules/react/index.js') },
        { find: /^react-dom$/, replacement: path.resolve(__dirname, 'node_modules/react-dom/index.js') },
        { find: '@leary/text-editable', replacement: textEditablePackageEntry },
        { find: '@leary/ui', replacement: uiPackageEntry },
        { find: '@leary/template-plugin-sdk-core', replacement: templatePluginSdkCoreEntry },
        { find: '@leary/template-plugin-sdk-host', replacement: templatePluginSdkHostEntry },
        { find: '@leary/template-ppt-runtime', replacement: templatePptRuntimeEntry },
        {
          find: '@leary/template-plugin-sdk-react/content',
          replacement: templatePluginSdkReactContentEntry,
        },
        { find: '@leary/template-plugin-sdk-react', replacement: templatePluginSdkReactEntry },
      ],
    },
    server: {
      host: '0.0.0.0',
      port: 8000,
      strictPort: true,
      proxy: {
        '/agent/ws': {
          target: agentWsTarget,
          changeOrigin: true,
          ws: true,
        },
        '/agent/query': {
          target: agentWsTarget,
          changeOrigin: true,
          ws: false,
        },
        '/sse': {
          target: sseTarget,
          changeOrigin: true,
          ws: false,
        },
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          ws: false,
        },
      },
    },
  }
})
