// runtimeConfig 负责收口浏览器注入的前端运行时配置。
export interface LearyRuntimeConfig {
  apiBaseUrl?: string;
  sseBaseUrl?: string;
  agentWsUrl?: string;
  adminBaseUrl?: string;
  templatePreviewBaseUrl?: string;
}

const normalizeValue = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

export const getRuntimeConfig = (): LearyRuntimeConfig => {
  if (typeof window === 'undefined') {
    return {};
  }

  const config = window.__LEARY_RUNTIME_CONFIG__;
  if (!config) {
    return {};
  }

  return {
    apiBaseUrl: normalizeValue(config.apiBaseUrl),
    sseBaseUrl: normalizeValue(config.sseBaseUrl),
    agentWsUrl: normalizeValue(config.agentWsUrl),
    adminBaseUrl: normalizeValue(config.adminBaseUrl),
    templatePreviewBaseUrl: normalizeValue(config.templatePreviewBaseUrl),
  };
};
