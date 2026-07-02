// deriveRenderUiState.test.ts 负责验证消息区 UI 状态的派生规则。
import { describe, expect, it } from 'vitest';
import { deriveRenderUiState } from '../deriveRenderUiState';
import { REPLACED_CONNECTION_MESSAGE } from '../renderConstants';

describe('deriveRenderUiState', () => {
  it('在无 activeSessionId 时返回空 UI 状态', () => {
    expect(
      deriveRenderUiState({
        activeSessionId: null,
        messages: [],
        sessionStatus: { exists: false, isStreaming: false },
        needContext: false,
        connectionStatus: { status: 'idle' },
      })
    ).toEqual({
      isStreaming: false,
      statusMessage: null,
      showWaitingRow: false,
      showQuickPromptWelcome: false,
      showTempSkeleton: false,
      showContextSkeleton: false,
      lastTextAssistantId: null,
    });
  });

  it('连接被替换时不会生成状态提示', () => {
    expect(
      deriveRenderUiState({
        activeSessionId: '__temp_session__',
        messages: [],
        sessionStatus: { exists: true, isStreaming: false },
        needContext: false,
        connectionStatus: { status: 'error', lastError: REPLACED_CONNECTION_MESSAGE },
      })
    ).toEqual({
      isStreaming: false,
      statusMessage: null,
      showWaitingRow: false,
      showQuickPromptWelcome: true,
      showTempSkeleton: false,
      showContextSkeleton: false,
      lastTextAssistantId: null,
    });
  });
});
