// useTemplatePluginClient.test.ts 负责验证 React hook 会复用 browser client 单例。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useMemo: vi.fn((factory: () => unknown) => factory()),
  browserClient: { id: 'browser-client' },
  getOrCreateTemplatePluginClient: vi.fn(() => ({ id: 'browser-client' })),
  resetTemplatePluginClientSingletonForHmr: vi.fn(),
}));

vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useMemo: mocks.useMemo,
  };
});

vi.mock('@leary/template-plugin-sdk-web', async () => {
  const actual = await vi.importActual('@leary/template-plugin-sdk-web');
  return {
    ...actual,
    getOrCreateTemplatePluginClient: mocks.getOrCreateTemplatePluginClient,
    resetTemplatePluginClientSingletonForHmr: mocks.resetTemplatePluginClientSingletonForHmr,
  };
});

import {
  resetTemplatePluginClientSingletonForHmr,
  useTemplatePluginClient,
} from '../useTemplatePluginClient';

describe('useTemplatePluginClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOrCreateTemplatePluginClient.mockReturnValue(mocks.browserClient);
  });

  it('会通过 useMemo 返回 browser client 单例', () => {
    const firstClient = useTemplatePluginClient();
    const secondClient = useTemplatePluginClient();

    expect(firstClient).toBe(mocks.browserClient);
    expect(secondClient).toBe(mocks.browserClient);
    expect(mocks.getOrCreateTemplatePluginClient).toHaveBeenCalledTimes(2);
    expect(mocks.useMemo).toHaveBeenCalledTimes(2);
  });

  it('会把 options 原样传给 browser client 工厂', () => {
    const options = {
      devtools: {
        mockRenderPayload: {
          content: '# 文档标题',
        },
      },
    };

    useTemplatePluginClient(options);

    expect(mocks.getOrCreateTemplatePluginClient).toHaveBeenCalledWith(options);
  });

  it('会透传 browser client 的 HMR reset 能力', () => {
    resetTemplatePluginClientSingletonForHmr();

    expect(mocks.resetTemplatePluginClientSingletonForHmr).toHaveBeenCalledTimes(1);
  });
});
