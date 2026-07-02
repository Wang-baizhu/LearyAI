// endpoints.test.ts 负责验证原生容器场景下的运行时地址解析优先级。
import { afterEach, describe, expect, it, vi } from 'vitest';

const nativeState = vi.hoisted(() => ({
  isNativeApp: false,
}));

vi.mock('@/app/runtime/platform/isNativeApp', () => ({
  isNativeApp: () => nativeState.isNativeApp,
}));

const loadEndpoints = async () => {
  vi.resetModules();
  return import('../endpoints');
};

const ensureWindow = () => {
  const runtimeGlobal = globalThis as { window?: Window };
  if (typeof runtimeGlobal.window === 'undefined') {
    runtimeGlobal.window = {} as Window;
  }
  return runtimeGlobal.window;
};

describe('endpoints', () => {
  afterEach(() => {
    nativeState.isNativeApp = false;
    vi.unstubAllEnvs();
    delete ensureWindow().__LEARY_RUNTIME_CONFIG__;
  });

  it('原生容器场景优先使用 VITE_NATIVE_* 地址', async () => {
    nativeState.isNativeApp = true;
    vi.stubEnv('VITE_API_BASE_URL', '/api');
    vi.stubEnv('VITE_NATIVE_API_BASE_URL', 'http://192.168.31.160/api/');
    vi.stubEnv('VITE_NATIVE_SSE_BASE_URL', 'http://192.168.31.160/sse/');
    vi.stubEnv('VITE_NATIVE_AGENT_WS_URL', 'ws://192.168.31.160/agent/ws');

    const { getRuntimeEndpoints } = await loadEndpoints();

    expect(getRuntimeEndpoints()).toEqual({
      apiBaseUrl: 'http://192.168.31.160/api',
      sseBaseUrl: 'http://192.168.31.160/sse',
      agentWsUrl: 'ws://192.168.31.160/agent/ws',
    });
  });

  it('非原生场景继续使用 Web 地址配置', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://web.example.com/api/');
    vi.stubEnv('VITE_SSE_BASE_URL', 'https://web.example.com/sse/');
    vi.stubEnv('VITE_AGENT_WS_URL', 'wss://web.example.com/agent/ws');
    vi.stubEnv('VITE_NATIVE_API_BASE_URL', 'http://192.168.31.160/api');

    const { getRuntimeEndpoints } = await loadEndpoints();

    expect(getRuntimeEndpoints()).toEqual({
      apiBaseUrl: 'https://web.example.com/api',
      sseBaseUrl: 'https://web.example.com/sse',
      agentWsUrl: 'wss://web.example.com/agent/ws',
    });
  });

  it('非原生场景优先使用运行时注入配置', async () => {
    ensureWindow().__LEARY_RUNTIME_CONFIG__ = {
      apiBaseUrl: '/api',
      sseBaseUrl: '/sse',
      agentWsUrl: '/agent/ws',
    };
    vi.stubEnv('VITE_API_BASE_URL', 'https://build.example.com/api/');
    vi.stubEnv('VITE_SSE_BASE_URL', 'https://build.example.com/sse/');
    vi.stubEnv('VITE_AGENT_WS_URL', 'wss://build.example.com/agent/ws');

    const { getRuntimeEndpoints } = await loadEndpoints();

    expect(getRuntimeEndpoints()).toEqual({
      apiBaseUrl: '/api',
      sseBaseUrl: '/sse',
      agentWsUrl: '/agent/ws',
    });
  });
});
