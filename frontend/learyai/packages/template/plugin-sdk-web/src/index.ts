// 职责: 统一导出模板插件 browser client 能力。
export {
  createTemplatePluginClient,
  getOrCreateTemplatePluginClient,
  resetTemplatePluginClientSingletonForHmr,
} from './createTemplatePluginClient';
export type {
  HostCapabilitiesSyncPayload,
  HostRenderPayload,
  HostThemeSyncPayload,
  TemplatePluginClient,
  TemplatePluginClientApi,
  TemplatePluginClientOptions,
} from './client/publicApi';
