// index 负责转发 template-plugin-sdk-web 包的公开入口。
export {
  createTemplatePluginClient,
  getOrCreateTemplatePluginClient,
  resetTemplatePluginClientSingletonForHmr,
} from './src/createTemplatePluginClient';
export type {
  HostCapabilitiesSyncPayload,
  HostRenderPayload,
  HostThemeSyncPayload,
  TemplatePluginClient,
  TemplatePluginClientApi,
  TemplatePluginClientOptions,
} from './src/client/publicApi';
