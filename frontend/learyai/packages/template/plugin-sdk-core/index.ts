// index 负责转发 template-plugin-sdk-core 包的公开入口。
export {
  TEMPLATE_PLUGIN_PROTOCOL,
  TemplatePluginMessageType,
  createTemplatePluginMessage,
} from './src/protocol';
export { createRequestId, createRequestTracker } from './src/requestTracker';
export { createMessageBus } from './src/messageBus';
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
} from './src/protocol';
