// 职责: 收敛模板插件 browser client 的宿主消息订阅与分发逻辑。
import {
  TEMPLATE_PLUGIN_PROTOCOL,
  TemplatePluginMessageType,
  type HostAiActionResponsePayload,
  type HostCapabilitiesSyncPayload,
  type HostCitationJumpResponsePayload,
  type HostContentSaveResponsePayload,
  type HostErrorPayload,
  type HostReadyAckPayload,
  type HostRenderPayload,
  type HostStorageClearResponsePayload,
  type HostStorageGetResponsePayload,
  type HostStorageInfoResponsePayload,
  type HostStorageRemoveResponsePayload,
  type HostStorageSetResponsePayload,
  type HostTextEditResponsePayload,
  type HostThemeSyncPayload,
} from '@leary/template-plugin-sdk-core';
import type { TemplatePluginRequestTrackers } from './requestTrackers';

export interface TemplatePluginSnapshotValueRef<TValue> {
  current: TValue;
}

export interface TemplatePluginSnapshotRefs {
  latestRenderPayloadRef: TemplatePluginSnapshotValueRef<HostRenderPayload | null>;
  latestThemePayloadRef: TemplatePluginSnapshotValueRef<HostThemeSyncPayload | null>;
  latestCapabilitiesPayloadRef: TemplatePluginSnapshotValueRef<HostCapabilitiesSyncPayload | null>;
}

interface SubscribeInboundMessage {
  <TPayload>(
    type: string,
    handler: (message: { requestId?: string; payload: TPayload }) => void,
  ): () => void;
}

interface RegisterTemplatePluginInboundHandlersParams {
  subscribeInboundMessage: SubscribeInboundMessage;
  markHostConnected: () => void;
  shouldMarkHostConnectedFromResponse?: () => boolean;
  requestTrackers: TemplatePluginRequestTrackers;
  snapshotRefs: TemplatePluginSnapshotRefs;
}

export const createInboundMessageSubscriber =
  () =>
  <TPayload,>(
    type: string,
    handler: (message: { requestId?: string; payload: TPayload }) => void,
  ) => {
    if (typeof window === 'undefined') {
      return () => {};
    }

    const handleMessage = (event: MessageEvent) => {
      const data = event.data as {
        protocol?: unknown;
        type?: unknown;
        requestId?: string;
        payload?: TPayload;
      } | null;

      if (!data || data.protocol !== TEMPLATE_PLUGIN_PROTOCOL || data.type !== type) {
        return;
      }

      handler({
        requestId: data.requestId,
        payload: data.payload as TPayload,
      });
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  };

export const registerTemplatePluginInboundHandlers = ({
  subscribeInboundMessage,
  markHostConnected,
  shouldMarkHostConnectedFromResponse,
  requestTrackers,
  snapshotRefs,
}: RegisterTemplatePluginInboundHandlersParams) => {
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

  const { latestRenderPayloadRef, latestThemePayloadRef, latestCapabilitiesPayloadRef } = snapshotRefs;
  const markConnectedFromResponse = () => {
    if (shouldMarkHostConnectedFromResponse?.() === false) {
      return;
    }
    markHostConnected();
  };

  const disposeReadyAck = subscribeInboundMessage<HostReadyAckPayload>(
    TemplatePluginMessageType.HOST_READY_ACK,
    () => {
      markHostConnected();
    },
  );
  const disposeRenderAck = subscribeInboundMessage<HostRenderPayload>(
    TemplatePluginMessageType.HOST_RENDER,
    ({ payload }) => {
      latestRenderPayloadRef.current = payload;
    },
  );
  const disposeThemeAck = subscribeInboundMessage<HostThemeSyncPayload>(
    TemplatePluginMessageType.HOST_THEME_SYNC,
    ({ payload }) => {
      latestThemePayloadRef.current = payload;
    },
  );
  const disposeDisposeAck = subscribeInboundMessage<Record<string, never>>(
    TemplatePluginMessageType.HOST_DISPOSE,
    () => {},
  );
  const disposeCapabilitiesAck = subscribeInboundMessage<HostCapabilitiesSyncPayload>(
    TemplatePluginMessageType.HOST_CAPABILITIES_SYNC,
    ({ payload }) => {
      latestCapabilitiesPayloadRef.current = payload;
    },
  );
  const disposeStorageSet = subscribeInboundMessage<HostStorageSetResponsePayload>(
    TemplatePluginMessageType.HOST_STORAGE_SET_RESPONSE,
    ({ requestId, payload }) => {
      markConnectedFromResponse();
      storageSetTracker.resolve(requestId, payload);
    },
  );
  const disposeStorageGet = subscribeInboundMessage<HostStorageGetResponsePayload>(
    TemplatePluginMessageType.HOST_STORAGE_GET_RESPONSE,
    ({ requestId, payload }) => {
      markConnectedFromResponse();
      storageGetTracker.resolve(requestId, payload);
    },
  );
  const disposeStorageInfo = subscribeInboundMessage<HostStorageInfoResponsePayload>(
    TemplatePluginMessageType.HOST_STORAGE_INFO_RESPONSE,
    ({ requestId, payload }) => {
      markConnectedFromResponse();
      storageInfoTracker.resolve(requestId, payload);
    },
  );
  const disposeStorageRemove = subscribeInboundMessage<HostStorageRemoveResponsePayload>(
    TemplatePluginMessageType.HOST_STORAGE_REMOVE_RESPONSE,
    ({ requestId, payload }) => {
      markConnectedFromResponse();
      storageRemoveTracker.resolve(requestId, payload);
    },
  );
  const disposeStorageClear = subscribeInboundMessage<HostStorageClearResponsePayload>(
    TemplatePluginMessageType.HOST_STORAGE_CLEAR_RESPONSE,
    ({ requestId, payload }) => {
      markConnectedFromResponse();
      storageClearTracker.resolve(requestId, payload);
    },
  );
  const disposeTextEdit = subscribeInboundMessage<HostTextEditResponsePayload>(
    TemplatePluginMessageType.HOST_TEXT_EDIT_RESPONSE,
    ({ requestId, payload }) => {
      markConnectedFromResponse();
      textEditTracker.resolve(requestId, payload);
    },
  );
  const disposeContentSave = subscribeInboundMessage<HostContentSaveResponsePayload>(
    TemplatePluginMessageType.HOST_CONTENT_SAVE_RESPONSE,
    ({ requestId, payload }) => {
      markConnectedFromResponse();
      contentSaveTracker.resolve(requestId, payload);
    },
  );
  const disposeAi = subscribeInboundMessage<HostAiActionResponsePayload>(
    TemplatePluginMessageType.HOST_AI_ACTION_RESPONSE,
    ({ requestId, payload }) => {
      markConnectedFromResponse();
      aiActionTracker.resolve(requestId, payload);
    },
  );
  const disposeCitation = subscribeInboundMessage<HostCitationJumpResponsePayload>(
    TemplatePluginMessageType.HOST_CITATION_JUMP_RESPONSE,
    ({ requestId, payload }) => {
      markConnectedFromResponse();
      citationJumpTracker.resolve(requestId, payload);
    },
  );
  const disposeHostError = subscribeInboundMessage<HostErrorPayload>(
    TemplatePluginMessageType.HOST_ERROR,
    ({ requestId, payload }) => {
      markConnectedFromResponse();
      storageSetTracker.reject(requestId, payload);
      storageGetTracker.reject(requestId, payload);
      storageInfoTracker.reject(requestId, payload);
      storageRemoveTracker.reject(requestId, payload);
      storageClearTracker.reject(requestId, payload);
      textEditTracker.reject(requestId, payload);
      contentSaveTracker.reject(requestId, payload);
      aiActionTracker.reject(requestId, payload);
      citationJumpTracker.reject(requestId, payload);
    },
  );

  return () => {
    disposeReadyAck();
    disposeRenderAck();
    disposeThemeAck();
    disposeDisposeAck();
    disposeCapabilitiesAck();
    disposeStorageSet();
    disposeStorageGet();
    disposeStorageInfo();
    disposeStorageRemove();
    disposeStorageClear();
    disposeTextEdit();
    disposeContentSave();
    disposeAi();
    disposeCitation();
    disposeHostError();
  };
};
