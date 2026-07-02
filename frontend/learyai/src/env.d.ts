/// <reference types="vite/client" />

// env 声明自定义 VITE_* 环境变量，供 shared/api/client 使用。
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_NATIVE_API_BASE_URL?: string;
  readonly VITE_SSE_BASE_URL?: string;
  readonly VITE_NATIVE_SSE_BASE_URL?: string;
  readonly VITE_PUBLIC_URL?: string;
  readonly VITE_AGENT_WS_URL?: string;
  readonly VITE_NATIVE_AGENT_WS_URL?: string;
  readonly VITE_AI_CHAT_MOCK_MODE?: string;
  // 更多 env 变量按需补充
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  __LEARY_RUNTIME_CONFIG__?: {
    apiBaseUrl?: string;
    sseBaseUrl?: string;
    agentWsUrl?: string;
    adminBaseUrl?: string;
    templatePreviewBaseUrl?: string;
  };
}

declare module '*.svg?raw' {
  const content: string;
  export default content;
}
