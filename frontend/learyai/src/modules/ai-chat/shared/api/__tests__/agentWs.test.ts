// agentWs.test.ts 负责验证 AI Chat WebSocket URL 构造逻辑。
import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnv = import.meta.env.VITE_AGENT_WS_URL;

const setEnv = (value?: string) => {
  vi.stubEnv('VITE_AGENT_WS_URL', value);
};

describe('agentWs', () => {
  afterEach(() => {
    setEnv(originalEnv);
    vi.unstubAllEnvs();
  });

  it('优先使用合法的 VITE_AGENT_WS_URL', async () => {
    setEnv('wss://example.com/custom/ws');
    const { buildAgentWsUrl } = await import('../agentWs');

    expect(buildAgentWsUrl()).toBe('wss://example.com/custom/ws');
  });

  it('环境变量非法时回退到默认地址', async () => {
    setEnv('://bad-url');
    const { buildAgentWsUrl } = await import('../agentWs');

    expect(buildAgentWsUrl()).toBe('ws://localhost:8081/agent/ws');
  });

  it('会基于 agent ws 地址推导 HTTP query 地址', async () => {
    setEnv('wss://example.com/custom/ws');
    const { buildAgentQueryUrl } = await import('../agentWs');

    expect(buildAgentQueryUrl()).toBe('https://example.com/custom/query');
  });

  it('会保留服务前缀来推导 HTTP query 地址', async () => {
    setEnv('wss://example.com/python-backend/agent/ws');
    const { buildAgentQueryUrl } = await import('../agentWs');

    expect(buildAgentQueryUrl()).toBe('https://example.com/python-backend/agent/query');
  });
});
