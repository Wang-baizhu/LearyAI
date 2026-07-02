// 职责: 组装模板插件 browser client 的对外订阅与请求 API。
import {
  TemplatePluginMessageType,
  createRequestId,
  createTemplatePluginMessage,
  type HostCapabilitiesSyncPayload,
  type HostRenderPayload,
  type HostStorageClearResponsePayload,
  type HostStorageGetResponsePayload,
  type HostStorageInfoResponsePayload,
  type HostStorageRemoveResponsePayload,
  type HostStorageSetResponsePayload,
  type HostThemeSyncPayload,
  type PluginAiActionRequestPayload,
  type PluginCitationJumpRequestPayload,
  type PluginContentSaveRequestPayload,
  type PluginStorageClearRequestPayload,
  type PluginStorageGetRequestPayload,
  type PluginStorageInfoRequestPayload,
  type PluginStorageRemoveRequestPayload,
  type PluginStorageSetRequestPayload,
  type PluginTextEditRequestPayload,
} from '@leary/template-plugin-sdk-core';
import type { TemplatePluginAnyMessage } from '@leary/template-plugin-sdk-core';
import type { TemplatePluginRequestTrackers } from './requestTrackers';

interface SubscribeInboundMessage {
  <TPayload>(
    type: string,
    handler: (message: { requestId?: string; payload: TPayload }) => void,
  ): () => void;
}

export interface TemplatePluginDevtoolsMockRenderPayload {
  content?: string;
}

export type {
  HostCapabilitiesSyncPayload,
  HostRenderPayload,
  HostThemeSyncPayload,
};

export interface TemplatePluginClientOptions {
  devtools?: {
    mockRenderPayload?: TemplatePluginDevtoolsMockRenderPayload;
  };
}

interface CreateTemplatePluginClientApiParams {
  beginReadyHandshake: () => void;
  subscribeInboundMessage: SubscribeInboundMessage;
  sendOrQueueMessage: (message: TemplatePluginAnyMessage) => void;
  requestTrackers: TemplatePluginRequestTrackers;
  getLatestRenderPayload: () => HostRenderPayload | null;
  getLatestThemePayload: () => HostThemeSyncPayload | null;
  getLatestCapabilitiesPayload: () => HostCapabilitiesSyncPayload | null;
}

const createTrackedRequest = <TResponse>({
  tracker,
  sendRequest,
}: {
  tracker: {
    create: (requestId: string) => { promise: Promise<TResponse> };
  };
  sendRequest: (requestId: string) => void;
}) => {
  const requestId = createRequestId();
  const { promise } = tracker.create(requestId);
  sendRequest(requestId);
  return promise;
};

type PublicPluginTextEditRequestPayload = Omit<PluginTextEditRequestPayload, 'pluginId'> & {
  pluginId?: never;
};

const resolveTextEditPluginId = (getLatestRenderPayload: () => HostRenderPayload | null) => {
  const pluginId = getLatestRenderPayload()?.pluginId;
  if (!pluginId) {
    throw new Error('requestTextEdit 需要宿主下发的 pluginId，请先接收 host.render 后再调用。');
  }
  return pluginId;
};

export const createTemplatePluginClientApi = ({
  beginReadyHandshake,
  subscribeInboundMessage,
  sendOrQueueMessage,
  requestTrackers,
  getLatestRenderPayload,
  getLatestThemePayload,
  getLatestCapabilitiesPayload,
}: CreateTemplatePluginClientApiParams) => {
  const {
    storageSetTracker,
    storageGetTracker,
    storageInfoTracker,
    storageRemoveTracker,
    storageClearTracker,
    textEditTracker,
    contentSaveTracker,
    aiActionTracker,
    citationJumpTracker,
  } = requestTrackers;

  return {
    signalReady: () => {
      beginReadyHandshake();
    },
    onRender: (handler: (payload: HostRenderPayload) => void) => {
      const latestRenderPayload = getLatestRenderPayload();
      if (latestRenderPayload) {
        handler(latestRenderPayload);
      }
      return subscribeInboundMessage<HostRenderPayload>(TemplatePluginMessageType.HOST_RENDER, ({ payload }) => {
        handler(payload);
      });
    },
    onThemeSync: (handler: (payload: HostThemeSyncPayload) => void) => {
      const latestThemePayload = getLatestThemePayload();
      if (latestThemePayload) {
        handler(latestThemePayload);
      }
      return subscribeInboundMessage<HostThemeSyncPayload>(
        TemplatePluginMessageType.HOST_THEME_SYNC,
        ({ payload }) => {
          handler(payload);
        },
      );
    },
    onDispose: (handler: () => void) =>
      subscribeInboundMessage<Record<string, never>>(TemplatePluginMessageType.HOST_DISPOSE, () => {
        handler();
      }),
    onCapabilitiesSync: (handler: (payload: HostCapabilitiesSyncPayload) => void) => {
      const latestCapabilitiesPayload = getLatestCapabilitiesPayload();
      if (latestCapabilitiesPayload) {
        handler(latestCapabilitiesPayload);
      }
      return subscribeInboundMessage<HostCapabilitiesSyncPayload>(
        TemplatePluginMessageType.HOST_CAPABILITIES_SYNC,
        ({ payload }) => {
          handler(payload);
        },
      );
    },
    onStorageSetResponse: (handler: (payload: HostStorageSetResponsePayload, requestId?: string) => void) =>
      subscribeInboundMessage<HostStorageSetResponsePayload>(
        TemplatePluginMessageType.HOST_STORAGE_SET_RESPONSE,
        ({ requestId, payload }) => {
          handler(payload, requestId);
        },
      ),
    onStorageGetResponse: (handler: (payload: HostStorageGetResponsePayload, requestId?: string) => void) =>
      subscribeInboundMessage<HostStorageGetResponsePayload>(
        TemplatePluginMessageType.HOST_STORAGE_GET_RESPONSE,
        ({ requestId, payload }) => {
          handler(payload, requestId);
        },
      ),
    onStorageInfoResponse: (
      handler: (payload: HostStorageInfoResponsePayload, requestId?: string) => void,
    ) =>
      subscribeInboundMessage<HostStorageInfoResponsePayload>(
        TemplatePluginMessageType.HOST_STORAGE_INFO_RESPONSE,
        ({ requestId, payload }) => {
          handler(payload, requestId);
        },
      ),
    onStorageRemoveResponse: (
      handler: (payload: HostStorageRemoveResponsePayload, requestId?: string) => void,
    ) =>
      subscribeInboundMessage<HostStorageRemoveResponsePayload>(
        TemplatePluginMessageType.HOST_STORAGE_REMOVE_RESPONSE,
        ({ requestId, payload }) => {
          handler(payload, requestId);
        },
      ),
    onStorageClearResponse: (
      handler: (payload: HostStorageClearResponsePayload, requestId?: string) => void,
    ) =>
      subscribeInboundMessage<HostStorageClearResponsePayload>(
        TemplatePluginMessageType.HOST_STORAGE_CLEAR_RESPONSE,
        ({ requestId, payload }) => {
          handler(payload, requestId);
        },
      ),
    requestSetStorage: (payload: PluginStorageSetRequestPayload) =>
      createTrackedRequest({
        tracker: storageSetTracker,
        sendRequest: (requestId) => {
          sendOrQueueMessage(
            createTemplatePluginMessage(
              TemplatePluginMessageType.PLUGIN_STORAGE_SET_REQUEST,
              payload,
              requestId,
            ),
          );
        },
      }),
    requestGetStorage: (payload: PluginStorageGetRequestPayload) =>
      createTrackedRequest({
        tracker: storageGetTracker,
        sendRequest: (requestId) => {
          sendOrQueueMessage(
            createTemplatePluginMessage(
              TemplatePluginMessageType.PLUGIN_STORAGE_GET_REQUEST,
              payload,
              requestId,
            ),
          );
        },
      }),
    requestGetStorageInfo: (payload: PluginStorageInfoRequestPayload = {}) =>
      createTrackedRequest({
        tracker: storageInfoTracker,
        sendRequest: (requestId) => {
          sendOrQueueMessage(
            createTemplatePluginMessage(
              TemplatePluginMessageType.PLUGIN_STORAGE_INFO_REQUEST,
              payload,
              requestId,
            ),
          );
        },
      }),
    requestRemoveStorage: (payload: PluginStorageRemoveRequestPayload) =>
      createTrackedRequest({
        tracker: storageRemoveTracker,
        sendRequest: (requestId) => {
          sendOrQueueMessage(
            createTemplatePluginMessage(
              TemplatePluginMessageType.PLUGIN_STORAGE_REMOVE_REQUEST,
              payload,
              requestId,
            ),
          );
        },
      }),
    requestClearStorage: (payload: PluginStorageClearRequestPayload = {}) =>
      createTrackedRequest({
        tracker: storageClearTracker,
        sendRequest: (requestId) => {
          sendOrQueueMessage(
            createTemplatePluginMessage(
              TemplatePluginMessageType.PLUGIN_STORAGE_CLEAR_REQUEST,
              payload,
              requestId,
            ),
          );
        },
      }),
    requestTextEdit: (payload: PublicPluginTextEditRequestPayload) => {
      if (Object.prototype.hasOwnProperty.call(payload as Record<string, unknown>, 'pluginId')) {
        throw new Error('requestTextEdit 不接受 pluginId，请移除该字段并依赖宿主 render 上下文。');
      }

      const requestPayload = {
        ...payload,
        pluginId: resolveTextEditPluginId(getLatestRenderPayload),
      };

      return createTrackedRequest({
        tracker: textEditTracker,
        sendRequest: (requestId) => {
          sendOrQueueMessage(
            createTemplatePluginMessage(
              TemplatePluginMessageType.PLUGIN_TEXT_EDIT_REQUEST,
              requestPayload,
              requestId,
            ),
          );
        },
      });
    },
    requestSaveContent: (payload: PluginContentSaveRequestPayload) =>
      createTrackedRequest({
        tracker: contentSaveTracker,
        sendRequest: (requestId) => {
          sendOrQueueMessage(
            createTemplatePluginMessage(
              TemplatePluginMessageType.PLUGIN_CONTENT_SAVE_REQUEST,
              payload,
              requestId,
            ),
          );
        },
      }),
    requestAiAction: (payload: PluginAiActionRequestPayload) =>
      createTrackedRequest({
        tracker: aiActionTracker,
        sendRequest: (requestId) => {
          sendOrQueueMessage(
            createTemplatePluginMessage(
              TemplatePluginMessageType.PLUGIN_AI_ACTION_REQUEST,
              payload,
              requestId,
            ),
          );
        },
      }),
    requestCitationJump: (payload: PluginCitationJumpRequestPayload) =>
      createTrackedRequest({
        tracker: citationJumpTracker,
        sendRequest: (requestId) => {
          sendOrQueueMessage(
            createTemplatePluginMessage(
              TemplatePluginMessageType.PLUGIN_CITATION_JUMP_REQUEST,
              payload,
              requestId,
            ),
          );
        },
      }),
  };
};

export type TemplatePluginClientApi = ReturnType<typeof createTemplatePluginClientApi>;
export interface TemplatePluginClient extends TemplatePluginClientApi {
  dispose: () => void;
}
