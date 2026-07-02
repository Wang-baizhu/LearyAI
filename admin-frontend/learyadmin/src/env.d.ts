/// <reference types="vite/client" />

// 责任：声明管理端使用的 VITE 环境变量类型。
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_PROXY_TARGET?: string;
  readonly VITE_PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
