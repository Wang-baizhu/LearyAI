// 职责: 定义模板插件宿主协议的正式消息类型与 payload 模型。
export const TEMPLATE_PLUGIN_PROTOCOL = 'leary.template-plugin.v1' as const;

export const TemplatePluginMessageType = {
  PLUGIN_READY: 'plugin.ready',
  PLUGIN_STORAGE_SET_REQUEST: 'plugin.storage.set.request',
  PLUGIN_STORAGE_GET_REQUEST: 'plugin.storage.get.request',
  PLUGIN_STORAGE_INFO_REQUEST: 'plugin.storage.info.request',
  PLUGIN_STORAGE_REMOVE_REQUEST: 'plugin.storage.remove.request',
  PLUGIN_STORAGE_CLEAR_REQUEST: 'plugin.storage.clear.request',
  PLUGIN_TEXT_EDIT_REQUEST: 'plugin.text-edit.request',
  PLUGIN_CONTENT_SAVE_REQUEST: 'plugin.content.save.request',
  PLUGIN_AI_ACTION_REQUEST: 'plugin.ai-action.request',
  PLUGIN_CITATION_JUMP_REQUEST: 'plugin.citation-jump.request',
  HOST_READY_ACK: 'host.ready.ack',
  HOST_RENDER: 'host.render',
  HOST_THEME_SYNC: 'host.theme.sync',
  HOST_DISPOSE: 'host.dispose',
  HOST_CAPABILITIES_SYNC: 'host.capabilities.sync',
  HOST_STORAGE_SET_RESPONSE: 'host.storage.set.response',
  HOST_STORAGE_GET_RESPONSE: 'host.storage.get.response',
  HOST_STORAGE_INFO_RESPONSE: 'host.storage.info.response',
  HOST_STORAGE_REMOVE_RESPONSE: 'host.storage.remove.response',
  HOST_STORAGE_CLEAR_RESPONSE: 'host.storage.clear.response',
  HOST_TEXT_EDIT_RESPONSE: 'host.text-edit.response',
  HOST_CONTENT_SAVE_RESPONSE: 'host.content.save.response',
  HOST_AI_ACTION_RESPONSE: 'host.ai-action.response',
  HOST_CITATION_JUMP_RESPONSE: 'host.citation-jump.response',
  HOST_ERROR: 'host.error',
} as const;

export type TemplatePluginMessageType =
  typeof TemplatePluginMessageType[keyof typeof TemplatePluginMessageType];

export interface TemplatePluginMessage<
  TType extends string = string,
  TPayload = unknown,
> {
  protocol: typeof TEMPLATE_PLUGIN_PROTOCOL;
  type: TType;
  requestId?: string;
  payload: TPayload;
}

export interface TemplatePluginErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export type PluginReadyPayload = Record<string, never>;

export interface HostRenderPayload {
  pluginId: string;
  templateId?: string;
  content?: string;
  data?: unknown;
  referenceTitles?: Record<string, string>;
}

export type HostReadyAckPayload = Record<string, never>;

export interface HostThemeSyncPayload {
  isDark: boolean;
}

export interface HostCapabilitiesSyncPayload {
  storage: boolean;
  textEdit: boolean;
  aiAction: boolean;
  citationJump: boolean;
}

export interface PluginStorageSetRequestPayload<TValue = unknown> {
  key: string;
  value: TValue;
}

export interface HostStorageSetResponsePayload<TValue = unknown> {
  key: string;
  success: boolean;
  value?: TValue;
}

export interface PluginStorageGetRequestPayload {
  key: string;
}

export interface HostStorageGetResponsePayload<TValue = unknown> {
  key: string;
  success: boolean;
  value?: TValue;
}

export type PluginStorageInfoRequestPayload = Record<string, never>;

export interface HostStorageInfoResponsePayload {
  success: boolean;
  keys: string[];
  currentSize: number;
  limitSize: number;
}

export interface PluginStorageRemoveRequestPayload {
  key: string;
}

export interface HostStorageRemoveResponsePayload {
  key: string;
  success: boolean;
}

export type PluginStorageClearRequestPayload = Record<string, never>;

export interface HostStorageClearResponsePayload {
  success: boolean;
}

export interface PluginTextEditRequestPayload {
  pluginId: string;
  title: string;
  value: string;
  multiline?: boolean;
  anchor: unknown;
}

export interface HostTextEditResponsePayload {
  success: boolean;
  value?: string;
}

export interface PluginContentSaveRequestPayload {
  content: string;
}

export interface HostContentSaveResponsePayload {
  success: boolean;
  content?: string;
}

export interface PluginAiActionRequestPayload {
  actionType: string;
  title?: string;
  content: string;
  metadata?: unknown;
}

export interface HostAiActionResponsePayload {
  success: boolean;
}

export interface PluginCitationJumpRequestPayload {
  source: string;
  pageText: string;
  label?: string;
  page?: string;
}

export interface HostCitationJumpResponsePayload {
  success: boolean;
}

export type HostErrorPayload = TemplatePluginErrorPayload;

export interface TemplatePluginMessagePayloadMap {
  [TemplatePluginMessageType.PLUGIN_READY]: PluginReadyPayload;
  [TemplatePluginMessageType.PLUGIN_STORAGE_SET_REQUEST]: PluginStorageSetRequestPayload;
  [TemplatePluginMessageType.PLUGIN_STORAGE_GET_REQUEST]: PluginStorageGetRequestPayload;
  [TemplatePluginMessageType.PLUGIN_STORAGE_INFO_REQUEST]: PluginStorageInfoRequestPayload;
  [TemplatePluginMessageType.PLUGIN_STORAGE_REMOVE_REQUEST]: PluginStorageRemoveRequestPayload;
  [TemplatePluginMessageType.PLUGIN_STORAGE_CLEAR_REQUEST]: PluginStorageClearRequestPayload;
  [TemplatePluginMessageType.PLUGIN_TEXT_EDIT_REQUEST]: PluginTextEditRequestPayload;
  [TemplatePluginMessageType.PLUGIN_CONTENT_SAVE_REQUEST]: PluginContentSaveRequestPayload;
  [TemplatePluginMessageType.PLUGIN_AI_ACTION_REQUEST]: PluginAiActionRequestPayload;
  [TemplatePluginMessageType.PLUGIN_CITATION_JUMP_REQUEST]: PluginCitationJumpRequestPayload;
  [TemplatePluginMessageType.HOST_READY_ACK]: HostReadyAckPayload;
  [TemplatePluginMessageType.HOST_RENDER]: HostRenderPayload;
  [TemplatePluginMessageType.HOST_THEME_SYNC]: HostThemeSyncPayload;
  [TemplatePluginMessageType.HOST_DISPOSE]: Record<string, never>;
  [TemplatePluginMessageType.HOST_CAPABILITIES_SYNC]: HostCapabilitiesSyncPayload;
  [TemplatePluginMessageType.HOST_STORAGE_SET_RESPONSE]: HostStorageSetResponsePayload;
  [TemplatePluginMessageType.HOST_STORAGE_GET_RESPONSE]: HostStorageGetResponsePayload;
  [TemplatePluginMessageType.HOST_STORAGE_INFO_RESPONSE]: HostStorageInfoResponsePayload;
  [TemplatePluginMessageType.HOST_STORAGE_REMOVE_RESPONSE]: HostStorageRemoveResponsePayload;
  [TemplatePluginMessageType.HOST_STORAGE_CLEAR_RESPONSE]: HostStorageClearResponsePayload;
  [TemplatePluginMessageType.HOST_TEXT_EDIT_RESPONSE]: HostTextEditResponsePayload;
  [TemplatePluginMessageType.HOST_CONTENT_SAVE_RESPONSE]: HostContentSaveResponsePayload;
  [TemplatePluginMessageType.HOST_AI_ACTION_RESPONSE]: HostAiActionResponsePayload;
  [TemplatePluginMessageType.HOST_CITATION_JUMP_RESPONSE]: HostCitationJumpResponsePayload;
  [TemplatePluginMessageType.HOST_ERROR]: HostErrorPayload;
}

export type TemplatePluginTypedMessage<
  TType extends keyof TemplatePluginMessagePayloadMap,
> = TemplatePluginMessage<TType, TemplatePluginMessagePayloadMap[TType]>;

export type TemplatePluginAnyMessage = {
  [K in keyof TemplatePluginMessagePayloadMap]: TemplatePluginTypedMessage<K>
}[keyof TemplatePluginMessagePayloadMap];

export const createTemplatePluginMessage = <
  TType extends keyof TemplatePluginMessagePayloadMap,
>(
  type: TType,
  payload: TemplatePluginMessagePayloadMap[TType],
  requestId?: string,
): TemplatePluginTypedMessage<TType> => ({
  protocol: TEMPLATE_PLUGIN_PROTOCOL,
  type,
  requestId,
  payload,
});
