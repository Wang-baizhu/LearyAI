// 职责: 统一导出模板插件协议、transport 与请求跟踪能力。
export {
  TEMPLATE_PLUGIN_PROTOCOL,
  TemplatePluginMessageType,
  createTemplatePluginMessage,
} from './protocol';
export { createRequestId, createRequestTracker } from './requestTracker';
export { createMessageBus } from './messageBus';
export type {
  HostAiActionResponsePayload,
  HostCapabilitiesSyncPayload,
  HostCitationJumpResponsePayload,
  HostContentSaveResponsePayload,
  HostErrorPayload,
  HostReadyAckPayload,
  HostRenderPayload,
  HostStorageClearResponsePayload,
  HostStorageGetResponsePayload,
  HostStorageInfoResponsePayload,
  HostStorageRemoveResponsePayload,
  HostStorageSetResponsePayload,
  HostTextEditResponsePayload,
  HostThemeSyncPayload,
  PluginAiActionRequestPayload,
  PluginCitationJumpRequestPayload,
  PluginContentSaveRequestPayload,
  PluginReadyPayload,
  PluginStorageClearRequestPayload,
  PluginStorageGetRequestPayload,
  PluginStorageInfoRequestPayload,
  PluginStorageRemoveRequestPayload,
  PluginStorageSetRequestPayload,
  PluginTextEditRequestPayload,
  TemplatePluginAnyMessage,
  TemplatePluginErrorPayload,
  TemplatePluginMessage,
  TemplatePluginMessagePayloadMap,
  TemplatePluginTypedMessage,
} from './protocol';
