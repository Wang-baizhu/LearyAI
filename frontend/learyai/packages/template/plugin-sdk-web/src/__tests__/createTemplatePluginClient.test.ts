// createTemplatePluginClient.test.ts 负责验证浏览器通用模板插件 client 的 ready 握手与请求行为。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const handlers = new Map<string, Set<(message: { requestId?: string; payload: unknown }) => void>>();
  const windowMessageHandlers = new Set<(event: MessageEvent) => void>();
  const send = vi.fn();
  const messageBusInstances: Array<{ dispose: ReturnType<typeof vi.fn> }> = [];
  const requestTrackerInstances: Array<{ abortAll: ReturnType<typeof vi.fn> }> = [];
  let requestCounter = 0;

  return {
    handlers,
    windowMessageHandlers,
    send,
    messageBusInstances,
    requestTrackerInstances,
    createMessageBus: vi.fn(() => {
      const bus = {
        send,
        on: (type: string, handler: (message: { requestId?: string; payload: unknown }) => void) => {
          const bucket = handlers.get(type) ?? new Set();
          bucket.add(handler);
          handlers.set(type, bucket);
          return () => {
            bucket.delete(handler);
            if (bucket.size === 0) {
              handlers.delete(type);
            }
          };
        },
        dispose: vi.fn(),
      };
      messageBusInstances.push(bus);
      return bus;
    }),
    createRequestId: vi.fn(() => {
      requestCounter += 1;
      return `request-id-${requestCounter}`;
    }),
    createRequestTracker: vi.fn(() => {
      const pending = new Map<
        string,
        {
          resolve: (value: unknown) => void;
          reject: (reason?: unknown) => void;
        }
      >();

      const tracker = {
        create: vi.fn((requestId: string) => {
          let resolvePromise: (value: unknown) => void = () => {};
          let rejectPromise: (reason?: unknown) => void = () => {};
          const promise = new Promise((resolve, reject) => {
            resolvePromise = resolve;
            rejectPromise = reject;
          });
          pending.set(requestId, {
            resolve: resolvePromise,
            reject: rejectPromise,
          });
          return { promise };
        }),
        resolve: vi.fn((requestId?: string, payload?: unknown) => {
          if (!requestId) {
            return;
          }
          pending.get(requestId)?.resolve(payload);
          pending.delete(requestId);
        }),
        reject: vi.fn((requestId?: string, payload?: unknown) => {
          if (!requestId) {
            return;
          }
          pending.get(requestId)?.reject(payload);
          pending.delete(requestId);
        }),
        abortAll: vi.fn(() => {
          pending.forEach(({ reject }) => {
            reject(new Error('aborted'));
          });
          pending.clear();
        }),
      };
      requestTrackerInstances.push(tracker);
      return tracker;
    }),
  };
});

vi.mock('@leary/template-plugin-sdk-core', async () => {
  const actual = await vi.importActual('@leary/template-plugin-sdk-core');
  return {
    ...actual,
    createMessageBus: mocks.createMessageBus,
    createRequestId: mocks.createRequestId,
    createRequestTracker: mocks.createRequestTracker,
  };
});

import { TemplatePluginMessageType } from '@leary/template-plugin-sdk-core';
import {
  getOrCreateTemplatePluginClient,
  resetTemplatePluginClientSingletonForHmr,
} from '../createTemplatePluginClient';

const emitHostMessage = (type: string, payload: unknown = {}, requestId?: string) => {
  const bucket = mocks.handlers.get(type);
  bucket?.forEach((handler) => handler({ requestId, payload }));
  mocks.windowMessageHandlers.forEach((handler) =>
    handler({
      data: {
        protocol: 'leary.template-plugin.v1',
        type,
        requestId,
        payload,
      },
      source: {},
    } as MessageEvent),
  );
};

describe('createTemplatePluginClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    mocks.handlers.clear();
    mocks.windowMessageHandlers.clear();
    mocks.messageBusInstances.length = 0;
    mocks.requestTrackerInstances.length = 0;
    mocks.createMessageBus.mockClear();
    mocks.createRequestId.mockClear();
    mocks.createRequestTracker.mockClear();
    mocks.send.mockClear();
    if (typeof globalThis.MessageEvent === 'undefined') {
      Object.defineProperty(globalThis, 'MessageEvent', {
        configurable: true,
        value: class MessageEvent {
          data: unknown;

          constructor(_type: string, init?: { data?: unknown }) {
            this.data = init?.data;
          }
        },
      });
    }
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        parent: {},
        addEventListener: vi.fn((type: string, handler: (event: MessageEvent) => void) => {
          if (type === 'message') {
            mocks.windowMessageHandlers.add(handler);
          }
        }),
        removeEventListener: vi.fn((type: string, handler: (event: MessageEvent) => void) => {
          if (type === 'message') {
            mocks.windowMessageHandlers.delete(handler);
          }
        }),
      },
    });
  });

  it('会按固定次数重试发送 plugin.ready，超过上限后停止', () => {
    getOrCreateTemplatePluginClient();

    vi.advanceTimersByTime(0);
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.send.mock.calls[0][0]).toMatchObject({
      type: TemplatePluginMessageType.PLUGIN_READY,
      payload: {},
    });

    vi.advanceTimersByTime(120);
    expect(mocks.send).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(320);
    expect(mocks.send).toHaveBeenCalledTimes(3);

    vi.advanceTimersByTime(800);
    expect(mocks.send).toHaveBeenCalledTimes(4);

    vi.advanceTimersByTime(1600);
    expect(mocks.send).toHaveBeenCalledTimes(5);
  });

  it('收到宿主 ack 后会停止后续 plugin.ready 重试', () => {
    getOrCreateTemplatePluginClient();

    vi.advanceTimersByTime(0);
    vi.advanceTimersByTime(120);
    expect(mocks.send).toHaveBeenCalledTimes(2);

    emitHostMessage(TemplatePluginMessageType.HOST_READY_ACK, {});

    vi.advanceTimersByTime(5000);
    expect(mocks.send).toHaveBeenCalledTimes(2);
  });

  it('onRender 晚注册时仍能收到最近一次快照', () => {
    const client = getOrCreateTemplatePluginClient();
    const handler = vi.fn();

    emitHostMessage(TemplatePluginMessageType.HOST_RENDER, {
      pluginId: 'plugin-1',
      templateId: 'tpl-1',
      content: '# card',
    });

    client.onRender(handler);

    expect(handler).toHaveBeenCalledWith({
      pluginId: 'plugin-1',
      templateId: 'tpl-1',
      content: '# card',
    });
  });

  it('宿主未 ack 前会暂存 requestGetStorage，请求在收到 ack 后再发送', () => {
    const client = getOrCreateTemplatePluginClient();

    client.requestGetStorage({ key: 'quiz-record' });

    expect(
      mocks.send.mock.calls.some(
        ([message]) => message.type === TemplatePluginMessageType.PLUGIN_STORAGE_GET_REQUEST,
      ),
    ).toBe(false);

    emitHostMessage(TemplatePluginMessageType.HOST_READY_ACK, {});

    expect(mocks.send.mock.calls.at(-1)?.[0]).toMatchObject({
      type: TemplatePluginMessageType.PLUGIN_STORAGE_GET_REQUEST,
      payload: { key: 'quiz-record' },
    });
  });

  it('requestTextEdit 会自动注入宿主 render 中的 pluginId', () => {
    const client = getOrCreateTemplatePluginClient();

    emitHostMessage(TemplatePluginMessageType.HOST_RENDER, {
      pluginId: 'plugin-1',
      templateId: 'tpl-1',
    });
    emitHostMessage(TemplatePluginMessageType.HOST_READY_ACK, {});

    client.requestTextEdit({
      title: '编辑正文',
      value: '原文',
      anchor: { section: 'body' },
    });

    expect(mocks.send.mock.calls.at(-1)?.[0]).toMatchObject({
      type: TemplatePluginMessageType.PLUGIN_TEXT_EDIT_REQUEST,
      payload: {
        pluginId: 'plugin-1',
        title: '编辑正文',
        value: '原文',
        anchor: { section: 'body' },
      },
    });
  });

  it('host.error 会 reject pending request', async () => {
    const client = getOrCreateTemplatePluginClient();
    const pendingPromise = client.requestGetStorage({ key: 'draft' });

    emitHostMessage(TemplatePluginMessageType.HOST_READY_ACK, {});
    const requestId = mocks.send.mock.calls.at(-1)?.[0]?.requestId;
    emitHostMessage(
      TemplatePluginMessageType.HOST_ERROR,
      { code: 'FAILED', message: 'broken' },
      requestId,
    );

    await expect(pendingPromise).rejects.toMatchObject({
      code: 'FAILED',
      message: 'broken',
    });
  });

  it('重置单例时会中止所有 pending request 并释放 bus', async () => {
    const client = getOrCreateTemplatePluginClient();
    const pendingPromise = client.requestGetStorage({ key: 'draft' });

    resetTemplatePluginClientSingletonForHmr();

    expect(mocks.messageBusInstances[0].dispose).toHaveBeenCalledTimes(1);
    expect(mocks.requestTrackerInstances).toHaveLength(9);
    mocks.requestTrackerInstances.forEach((tracker) => {
      expect(tracker.abortAll).toHaveBeenCalledTimes(1);
    });

    await expect(pendingPromise).rejects.toThrow('aborted');
  });
});
