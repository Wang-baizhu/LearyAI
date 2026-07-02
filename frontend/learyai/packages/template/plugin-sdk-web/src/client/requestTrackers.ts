// 职责: 统一创建模板插件 browser client 需要的各类宿主请求 tracker。
import { createRequestTracker } from '@leary/template-plugin-sdk-core';
import type {
  HostAiActionResponsePayload,
  HostCitationJumpResponsePayload,
  HostContentSaveResponsePayload,
  HostStorageClearResponsePayload,
  HostStorageGetResponsePayload,
  HostStorageInfoResponsePayload,
  HostStorageRemoveResponsePayload,
  HostStorageSetResponsePayload,
  HostTextEditResponsePayload,
} from '@leary/template-plugin-sdk-core';

export const createTemplatePluginRequestTrackers = () => ({
  storageSetTracker: createRequestTracker<HostStorageSetResponsePayload>(),
  storageGetTracker: createRequestTracker<HostStorageGetResponsePayload>(),
  storageInfoTracker: createRequestTracker<HostStorageInfoResponsePayload>(),
  storageRemoveTracker: createRequestTracker<HostStorageRemoveResponsePayload>(),
  storageClearTracker: createRequestTracker<HostStorageClearResponsePayload>(),
  textEditTracker: createRequestTracker<HostTextEditResponsePayload>(),
  contentSaveTracker: createRequestTracker<HostContentSaveResponsePayload>(),
  aiActionTracker: createRequestTracker<HostAiActionResponsePayload>(),
  citationJumpTracker: createRequestTracker<HostCitationJumpResponsePayload>(),
});

export type TemplatePluginRequestTrackers = ReturnType<typeof createTemplatePluginRequestTrackers>;
