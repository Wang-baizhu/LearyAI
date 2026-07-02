// 职责: 为非 React 模板提供窗口级单例宿主协议 client。
import {
  TemplatePluginMessageType,
  createMessageBus,
  createTemplatePluginMessage,
  type HostCapabilitiesSyncPayload,
  type HostRenderPayload,
  type HostThemeSyncPayload,
  type TemplatePluginAnyMessage,
} from '@leary/template-plugin-sdk-core';
import {
  createTemplatePluginClientApi,
  type TemplatePluginClient,
  type TemplatePluginClientApi,
  type TemplatePluginClientOptions,
} from './client/publicApi';
import { createTemplatePluginRequestTrackers } from './client/requestTrackers';
import {
  createInboundMessageSubscriber,
  registerTemplatePluginInboundHandlers,
} from './client/subscriptions';

const READY_RETRY_DELAYS = [0, 120, 320, 800, 1600] as const;
const WINDOW_SINGLETON_KEY = '__LEARY_TEMPLATE_PLUGIN_WEB_CLIENT_SINGLETON__';
const DEVTOOLS_DEFAULT_PLUGIN_ID = 'devtools-default-plugin';
const DEVTOOLS_DEFAULT_TEMPLATE_ID = 'devtools-default-template';

interface TemplatePluginClientSingleton {
  client: TemplatePluginClient;
  dispose: () => void;
}

interface TemplatePluginClientWindow extends Window {
  [WINDOW_SINGLETON_KEY]?: TemplatePluginClientSingleton;
}

const getWindowObject = () => {
  if (typeof window === 'undefined') {
    throw new Error('createTemplatePluginClient 只能在浏览器环境中使用。');
  }

  return window as TemplatePluginClientWindow;
};

const abortAllPendingRequests = (
  requestTrackers: ReturnType<typeof createTemplatePluginRequestTrackers>,
) => {
  requestTrackers.storageSetTracker.abortAll();
  requestTrackers.storageGetTracker.abortAll();
  requestTrackers.storageInfoTracker.abortAll();
  requestTrackers.storageRemoveTracker.abortAll();
  requestTrackers.storageClearTracker.abortAll();
  requestTrackers.textEditTracker.abortAll();
  requestTrackers.contentSaveTracker.abortAll();
  requestTrackers.aiActionTracker.abortAll();
  requestTrackers.citationJumpTracker.abortAll();
};

const buildDevtoolsRenderPayload = (options?: TemplatePluginClientOptions): HostRenderPayload | null => {
  const mockRenderPayload = options?.devtools?.mockRenderPayload;
  if (!mockRenderPayload) {
    return null;
  }

  return {
    pluginId: DEVTOOLS_DEFAULT_PLUGIN_ID,
    templateId: DEVTOOLS_DEFAULT_TEMPLATE_ID,
    content: mockRenderPayload.content,
    referenceTitles: {},
  };
};

const createTemplatePluginClientSingleton = (
  options?: TemplatePluginClientOptions,
): TemplatePluginClientSingleton => {
  let hostConnected = false;
  let readyAttemptIndex = 0;
  let readyTimer: ReturnType<typeof setTimeout> | null = null;
  let latestRenderPayload: HostRenderPayload | null = buildDevtoolsRenderPayload(options);
  let latestThemePayload: HostThemeSyncPayload | null = null;
  let latestCapabilitiesPayload: HostCapabilitiesSyncPayload | null = null;
  let outboundQueue: TemplatePluginAnyMessage[] = [];

  const bus = createMessageBus({
    getTargetWindow: () => window.parent || window,
  });
  const requestTrackers = createTemplatePluginRequestTrackers();
  const subscribeInboundMessage = createInboundMessageSubscriber();

  const clearReadyTimer = () => {
    if (!readyTimer) {
      return;
    }
    clearTimeout(readyTimer);
    readyTimer = null;
  };

  const sendOrQueueMessage = (message: TemplatePluginAnyMessage) => {
    if (hostConnected) {
      bus.send(message);
      return;
    }

    outboundQueue.push(message);
  };

  const markHostConnected = () => {
    hostConnected = true;
    clearReadyTimer();
    if (outboundQueue.length === 0) {
      return;
    }

    const pendingMessages = [...outboundQueue];
    outboundQueue = [];
    pendingMessages.forEach((message) => {
      bus.send(message);
    });
  };

  const sendReadyMessage = () => {
    bus.send(
      createTemplatePluginMessage(TemplatePluginMessageType.PLUGIN_READY, {}),
    );
  };

  const beginReadyHandshake = () => {
    hostConnected = false;
    readyAttemptIndex = 0;
    clearReadyTimer();

    const scheduleRetry = () => {
      if (readyAttemptIndex >= READY_RETRY_DELAYS.length) {
        readyTimer = null;
        return;
      }

      const delay = READY_RETRY_DELAYS[readyAttemptIndex];
      readyTimer = setTimeout(() => {
        if (hostConnected) {
          return;
        }

        sendReadyMessage();
        readyAttemptIndex += 1;
        scheduleRetry();
      }, delay);
    };

    scheduleRetry();
  };

  const disposeInboundHandlers = registerTemplatePluginInboundHandlers({
    subscribeInboundMessage,
    markHostConnected,
    shouldMarkHostConnectedFromResponse: () => hostConnected,
    requestTrackers,
    snapshotRefs: {
      latestRenderPayloadRef: {
        get current() {
          return latestRenderPayload;
        },
        set current(value: HostRenderPayload | null) {
          latestRenderPayload = value;
        },
      },
      latestThemePayloadRef: {
        get current() {
          return latestThemePayload;
        },
        set current(value: HostThemeSyncPayload | null) {
          latestThemePayload = value;
        },
      },
      latestCapabilitiesPayloadRef: {
        get current() {
          return latestCapabilitiesPayload;
        },
        set current(value: HostCapabilitiesSyncPayload | null) {
          latestCapabilitiesPayload = value;
        },
      },
    },
  });

  const client = createTemplatePluginClientApi({
    beginReadyHandshake,
    subscribeInboundMessage,
    sendOrQueueMessage,
    requestTrackers,
    getLatestRenderPayload: () => latestRenderPayload,
    getLatestThemePayload: () => latestThemePayload,
    getLatestCapabilitiesPayload: () => latestCapabilitiesPayload,
  });

  beginReadyHandshake();

  const disposeClient = () => {
    clearReadyTimer();
    outboundQueue = [];
    disposeInboundHandlers();
    abortAllPendingRequests(requestTrackers);
    bus.dispose();
  };

  return {
    client: {
      ...(client as TemplatePluginClientApi),
      dispose: disposeClient,
    },
    dispose: disposeClient,
  };
};

export const createTemplatePluginClient = (options?: TemplatePluginClientOptions) => {
  return createTemplatePluginClientSingleton(options).client;
};

export const getOrCreateTemplatePluginClient = (options?: TemplatePluginClientOptions) => {
  const windowObject = getWindowObject();
  const currentSingleton = windowObject[WINDOW_SINGLETON_KEY];

  if (currentSingleton) {
    return currentSingleton.client;
  }

  const nextSingleton = createTemplatePluginClientSingleton(options);
  windowObject[WINDOW_SINGLETON_KEY] = nextSingleton;
  return nextSingleton.client;
};

export const resetTemplatePluginClientSingletonForHmr = () => {
  const windowObject = getWindowObject();
  windowObject[WINDOW_SINGLETON_KEY]?.dispose();
  delete windowObject[WINDOW_SINGLETON_KEY];
};

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    resetTemplatePluginClientSingletonForHmr();
  });
}
