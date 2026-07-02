// endpoints 负责统一收口 API、SSE 与 Agent WebSocket 的运行时地址。
import { isNativeApp } from '@/app/runtime/platform/isNativeApp';
import { getRuntimeConfig } from './runtimeConfig';

export interface RuntimeEndpoints {
  apiBaseUrl: string;
  sseBaseUrl: string;
  agentWsUrl: string;
}

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const ensurePathname = (pathname: string) => (pathname.startsWith('/') ? pathname : `/${pathname}`);

const joinUrl = (base: string, pathname: string) => {
  if (/^https?:\/\//.test(base) || /^wss?:\/\//.test(base)) {
    const url = new URL(base);
    url.pathname = `${trimTrailingSlash(url.pathname)}${ensurePathname(pathname)}`;
    url.search = '';
    url.hash = '';
    return url.toString();
  }
  return `${trimTrailingSlash(base)}${ensurePathname(pathname)}`;
};

const resolveWsFromApiBase = (apiBaseUrl: string) => {
  if (/^https?:\/\//.test(apiBaseUrl)) {
    const httpUrl = new URL(apiBaseUrl);
    httpUrl.protocol = httpUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    httpUrl.pathname = '/agent/ws';
    httpUrl.search = '';
    httpUrl.hash = '';
    return httpUrl.toString();
  }
  if (/^wss?:\/\//.test(apiBaseUrl)) {
    return joinUrl(apiBaseUrl, '/agent/ws');
  }
  if (typeof window !== 'undefined' && window.location) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/agent/ws`;
  }
  return 'ws://localhost:8081/agent/ws';
};

const resolveSseFromApiBase = (apiBaseUrl: string) => {
  if (apiBaseUrl.endsWith('/api')) {
    return `${apiBaseUrl.slice(0, -4)}/sse`;
  }
  return joinUrl(apiBaseUrl, '/sse');
};

const resolveApiBaseUrl = () => {
  const runtimeConfig = getRuntimeConfig();
  const nativeApiBaseUrl = import.meta.env.VITE_NATIVE_API_BASE_URL?.trim();
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

  if (isNativeApp()) {
    if (nativeApiBaseUrl) {
      return trimTrailingSlash(nativeApiBaseUrl);
    }
    if (apiBaseUrl && /^https?:\/\//.test(apiBaseUrl)) {
      return trimTrailingSlash(apiBaseUrl);
    }
  }

  if (runtimeConfig.apiBaseUrl) {
    return trimTrailingSlash(runtimeConfig.apiBaseUrl);
  }

  if (apiBaseUrl) {
    return trimTrailingSlash(apiBaseUrl);
  }

  return '/api';
};

export const getRuntimeEndpoints = (): RuntimeEndpoints => {
  const runtimeConfig = getRuntimeConfig();
  const apiBaseUrl = resolveApiBaseUrl();
  const nativeSseBaseUrl = import.meta.env.VITE_NATIVE_SSE_BASE_URL?.trim();
  const sseBaseUrl = trimTrailingSlash(
    isNativeApp() && nativeSseBaseUrl
      ? nativeSseBaseUrl
      : runtimeConfig.sseBaseUrl ||
          import.meta.env.VITE_SSE_BASE_URL?.trim() ||
          resolveSseFromApiBase(apiBaseUrl),
  );
  const nativeAgentWsUrl = import.meta.env.VITE_NATIVE_AGENT_WS_URL?.trim();
  const agentWsUrl =
    (isNativeApp() && nativeAgentWsUrl ? nativeAgentWsUrl : undefined) ||
    runtimeConfig.agentWsUrl ||
    import.meta.env.VITE_AGENT_WS_URL?.trim() ||
    resolveWsFromApiBase(apiBaseUrl);

  return {
    apiBaseUrl,
    sseBaseUrl,
    agentWsUrl,
  };
};

export const buildSseUrl = (pathname: string, search = '') => {
  const { sseBaseUrl } = getRuntimeEndpoints();
  return `${joinUrl(sseBaseUrl, pathname)}${search}`;
};
