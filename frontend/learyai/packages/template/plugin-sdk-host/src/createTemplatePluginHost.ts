// 职责: 为资源宿主提供统一的模板插件协议 host adapter。
import {
  TemplatePluginMessageType,
  createMessageBus,
  createTemplatePluginMessage,
  type TemplatePluginAnyMessage,
  type HostReadyAckPayload,
  type HostAiActionResponsePayload,
  type HostCapabilitiesSyncPayload,
  type HostContentSaveResponsePayload,
  type HostCitationJumpResponsePayload,
  type HostStorageClearResponsePayload,
  type HostStorageGetResponsePayload,
  type HostStorageInfoResponsePayload,
  type HostStorageRemoveResponsePayload,
  type HostStorageSetResponsePayload,
  type HostErrorPayload,
  type HostRenderPayload,
  type HostTextEditResponsePayload,
  type PluginAiActionRequestPayload,
  type PluginContentSaveRequestPayload,
  type PluginCitationJumpRequestPayload,
  type PluginStorageClearRequestPayload,
  type PluginStorageGetRequestPayload,
  type PluginStorageInfoRequestPayload,
  type PluginStorageRemoveRequestPayload,
  type PluginStorageSetRequestPayload,
  type PluginTextEditRequestPayload,
} from '@leary/template-plugin-sdk-core';

type HostHandlerMap = {
  storageSet: PluginStorageSetRequestPayload;
  storageGet: PluginStorageGetRequestPayload;
  storageInfo: PluginStorageInfoRequestPayload;
  storageRemove: PluginStorageRemoveRequestPayload;
  storageClear: PluginStorageClearRequestPayload;
  contentSave: PluginContentSaveRequestPayload;
  aiAction: PluginAiActionRequestPayload;
  citationJump: PluginCitationJumpRequestPayload;
};

type HostHandlerResultMap = {
  storageSet: HostStorageSetResponsePayload;
  storageGet: HostStorageGetResponsePayload;
  storageInfo: HostStorageInfoResponsePayload;
  storageRemove: HostStorageRemoveResponsePayload;
  storageClear: HostStorageClearResponsePayload;
  textEdit: HostTextEditResponsePayload;
  contentSave: HostContentSaveResponsePayload;
  aiAction: HostAiActionResponsePayload;
  citationJump: HostCitationJumpResponsePayload;
};

interface CreateTemplatePluginHostOptions {
  targetWindow: Window | null;
}

const normalizeError = (error: unknown): HostErrorPayload => {
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    return error as HostErrorPayload;
  }
  return {
    code: 'HOST_REQUEST_FAILED',
    message: error instanceof Error ? error.message : 'host request failed',
    details: error,
  };
};

export const createTemplatePluginHost = ({
  targetWindow,
}: CreateTemplatePluginHostOptions) => {
  const bus = createMessageBus({
    getTargetWindow: () => targetWindow,
    acceptSource: (source) => !targetWindow || source === targetWindow,
  });

  const replyError = (payload: HostErrorPayload, requestId?: string) => {
    bus.send(
      createTemplatePluginMessage(TemplatePluginMessageType.HOST_ERROR, payload, requestId),
    );
  };

  const replySuccess = <TType extends keyof HostHandlerResultMap>(
    type: TType,
    payload: HostHandlerResultMap[TType],
    requestId?: string,
  ) => {
    const responseTypeMap = {
      storageSet: TemplatePluginMessageType.HOST_STORAGE_SET_RESPONSE,
      storageGet: TemplatePluginMessageType.HOST_STORAGE_GET_RESPONSE,
      storageInfo: TemplatePluginMessageType.HOST_STORAGE_INFO_RESPONSE,
      storageRemove: TemplatePluginMessageType.HOST_STORAGE_REMOVE_RESPONSE,
      storageClear: TemplatePluginMessageType.HOST_STORAGE_CLEAR_RESPONSE,
      textEdit: TemplatePluginMessageType.HOST_TEXT_EDIT_RESPONSE,
      contentSave: TemplatePluginMessageType.HOST_CONTENT_SAVE_RESPONSE,
      aiAction: TemplatePluginMessageType.HOST_AI_ACTION_RESPONSE,
      citationJump: TemplatePluginMessageType.HOST_CITATION_JUMP_RESPONSE,
    } as const;
    bus.send(
      createTemplatePluginMessage(responseTypeMap[type], payload as never, requestId) as TemplatePluginAnyMessage,
    );
  };

  return {
    onPluginReady: (handler: () => void) =>
      bus.on(TemplatePluginMessageType.PLUGIN_READY, ({ payload }) => {
        void payload;
        handler();
      }),
    sendReadyAck: (payload: HostReadyAckPayload = {}) => {
      bus.send(
        createTemplatePluginMessage(TemplatePluginMessageType.HOST_READY_ACK, payload),
      );
    },
    onTextEditRequest: (
      handler: (payload: PluginTextEditRequestPayload, requestId?: string) => void,
    ) =>
      bus.on(TemplatePluginMessageType.PLUGIN_TEXT_EDIT_REQUEST, ({ requestId, payload }) => {
        handler(payload, requestId);
      }),
    registerHandler: <TType extends keyof HostHandlerMap>(
      type: TType,
      handler: (
        payload: HostHandlerMap[TType],
        requestId?: string,
      ) => Promise<HostHandlerResultMap[TType]> | HostHandlerResultMap[TType],
    ) => {
      const requestTypeMap = {
        storageSet: TemplatePluginMessageType.PLUGIN_STORAGE_SET_REQUEST,
        storageGet: TemplatePluginMessageType.PLUGIN_STORAGE_GET_REQUEST,
        storageInfo: TemplatePluginMessageType.PLUGIN_STORAGE_INFO_REQUEST,
        storageRemove: TemplatePluginMessageType.PLUGIN_STORAGE_REMOVE_REQUEST,
        storageClear: TemplatePluginMessageType.PLUGIN_STORAGE_CLEAR_REQUEST,
        contentSave: TemplatePluginMessageType.PLUGIN_CONTENT_SAVE_REQUEST,
        aiAction: TemplatePluginMessageType.PLUGIN_AI_ACTION_REQUEST,
        citationJump: TemplatePluginMessageType.PLUGIN_CITATION_JUMP_REQUEST,
      } as const;
      return bus.on(requestTypeMap[type], async ({ requestId, payload }) => {
        try {
          const result = await handler(payload as HostHandlerMap[TType], requestId);
          replySuccess(type, result, requestId);
        } catch (error) {
          replyError(normalizeError(error), requestId);
        }
      });
    },
    sendRender: (payload: HostRenderPayload) => {
      bus.send(createTemplatePluginMessage(TemplatePluginMessageType.HOST_RENDER, payload));
    },
    syncTheme: (isDark: boolean) => {
      bus.send(
        createTemplatePluginMessage(TemplatePluginMessageType.HOST_THEME_SYNC, { isDark }),
      );
    },
    syncCapabilities: (payload: HostCapabilitiesSyncPayload) => {
      bus.send(
        createTemplatePluginMessage(
          TemplatePluginMessageType.HOST_CAPABILITIES_SYNC,
          payload,
        ),
      );
    },
    sendStorageSetResponse: (payload: HostStorageSetResponsePayload, requestId?: string) => {
      replySuccess('storageSet', payload, requestId);
    },
    sendStorageGetResponse: (payload: HostStorageGetResponsePayload, requestId?: string) => {
      replySuccess('storageGet', payload, requestId);
    },
    sendStorageInfoResponse: (payload: HostStorageInfoResponsePayload, requestId?: string) => {
      replySuccess('storageInfo', payload, requestId);
    },
    sendStorageRemoveResponse: (payload: HostStorageRemoveResponsePayload, requestId?: string) => {
      replySuccess('storageRemove', payload, requestId);
    },
    sendStorageClearResponse: (payload: HostStorageClearResponsePayload, requestId?: string) => {
      replySuccess('storageClear', payload, requestId);
    },
    replyTextEdit: (payload: HostTextEditResponsePayload, requestId?: string) => {
      replySuccess('textEdit', payload, requestId);
    },
    replyContentSave: (payload: HostContentSaveResponsePayload, requestId?: string) => {
      replySuccess('contentSave', payload, requestId);
    },
    replyAiAction: (payload: HostAiActionResponsePayload, requestId?: string) => {
      replySuccess('aiAction', payload, requestId);
    },
    replyCitationJump: (payload: HostCitationJumpResponsePayload, requestId?: string) => {
      replySuccess('citationJump', payload, requestId);
    },
    sendDispose: () => {
      bus.send(
        createTemplatePluginMessage(TemplatePluginMessageType.HOST_DISPOSE, {}),
      );
    },
    sendError: replyError,
    dispose: () => {
      bus.dispose();
    },
  };
};
