// 职责: 提供基于 window.postMessage 的模板插件协议消息总线。
import {
  TEMPLATE_PLUGIN_PROTOCOL,
  type TemplatePluginAnyMessage,
  type TemplatePluginMessagePayloadMap,
} from './protocol';

interface CreateMessageBusOptions {
  getTargetWindow: () => Window | null;
  acceptSource?: (source: MessageEvent['source']) => boolean;
}

type MessageHandler<TType extends keyof TemplatePluginMessagePayloadMap> = (
  message: {
    requestId?: string;
    payload: TemplatePluginMessagePayloadMap[TType];
  }
) => void;

type AnyMessageHandler = (message: { requestId?: string; payload: unknown }) => void;

const isPluginMessage = (value: unknown): value is TemplatePluginAnyMessage => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<TemplatePluginAnyMessage>;
  return candidate.protocol === TEMPLATE_PLUGIN_PROTOCOL && typeof candidate.type === 'string';
};

export const createMessageBus = ({
  getTargetWindow,
  acceptSource,
}: CreateMessageBusOptions) => {
  const windowObject = typeof window !== 'undefined' ? window : null;
  const listeners = new Map<string, Set<AnyMessageHandler>>();

  const handleMessage = (event: MessageEvent) => {
    if (acceptSource && !acceptSource(event.source)) {
      return;
    }
    if (!isPluginMessage(event.data)) {
      return;
    }
    const handlers = listeners.get(event.data.type);
    if (!handlers || handlers.size === 0) {
      return;
    }
    handlers.forEach((handler) => {
      handler({
        requestId: event.data.requestId,
        payload: event.data.payload,
      });
    });
  };

  windowObject?.addEventListener('message', handleMessage);

  return {
    send: (message: TemplatePluginAnyMessage) => {
      const targetWindow = getTargetWindow();
      if (!targetWindow || typeof targetWindow.postMessage !== 'function') {
        return;
      }
      targetWindow.postMessage(message, '*');
    },
    on: <TType extends keyof TemplatePluginMessagePayloadMap>(
      type: TType,
      handler: MessageHandler<TType>,
    ) => {
      const handlers = listeners.get(type) ?? new Set();
      handlers.add(handler as AnyMessageHandler);
      listeners.set(type, handlers);
      return () => {
        const currentHandlers = listeners.get(type);
        if (!currentHandlers) {
          return;
        }
        currentHandlers.delete(handler as AnyMessageHandler);
        if (currentHandlers.size === 0) {
          listeners.delete(type);
        }
      };
    },
    dispose: () => {
      listeners.clear();
      windowObject?.removeEventListener('message', handleMessage);
    },
  };
};
