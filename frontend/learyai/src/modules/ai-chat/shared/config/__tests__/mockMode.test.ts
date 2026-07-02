// mockMode.test.ts 负责验证 AI Chat mock 模式环境变量解析。
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAiChatMockCollectEnabled, isAiChatMockModeEnabled } from '../mockMode';

describe('isAiChatMockModeEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('在未配置环境变量时返回 false', () => {
    expect(isAiChatMockModeEnabled()).toBe(false);
  });

  it('识别 true / 1 / on', () => {
    vi.stubEnv('VITE_AI_CHAT_MOCK_MODE', 'true');
    expect(isAiChatMockModeEnabled()).toBe(true);

    vi.stubEnv('VITE_AI_CHAT_MOCK_MODE', '1');
    expect(isAiChatMockModeEnabled()).toBe(true);

    vi.stubEnv('VITE_AI_CHAT_MOCK_MODE', 'on');
    expect(isAiChatMockModeEnabled()).toBe(true);
  });

  it('识别其他值为 false', () => {
    vi.stubEnv('VITE_AI_CHAT_MOCK_MODE', 'off');
    expect(isAiChatMockModeEnabled()).toBe(false);
  });

  it('识别 VITE_AI_CHAT_MOCK_COLLECT', () => {
    vi.stubEnv('VITE_AI_CHAT_MOCK_COLLECT', '1');
    expect(isAiChatMockCollectEnabled()).toBe(true);

    vi.stubEnv('VITE_AI_CHAT_MOCK_COLLECT', 'off');
    expect(isAiChatMockCollectEnabled()).toBe(false);
  });
});
