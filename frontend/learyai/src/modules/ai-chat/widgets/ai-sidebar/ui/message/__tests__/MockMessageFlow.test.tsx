import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { configureStore } from '@reduxjs/toolkit';
import { Provider, useSelector } from 'react-redux';
import { describe, expect, it, vi } from 'vitest';
import SidebarChatMessages from '../SidebarChatMessages';
import aiChatReducer, {
  TEMP_SESSION_ID,
  setActiveSessionId,
} from '@/modules/ai-chat/entities/chat/model/store/slice';
import { selectActiveSessionId } from '@/modules/ai-chat/entities/chat/model/selectors/state';
import {
  selectActiveSessionRenderMessages,
  selectActiveSessionRenderUiState,
} from '@/modules/ai-chat/entities/chat/model/selectors/render';
import { buildDebugMockEnvelope, processSocketEnvelope } from '@/modules/ai-chat/features/connect/model/effects/socketEnvelopeHandler';
import { createAiChatWireEventProcessor } from '@/modules/ai-chat/features/connect/lib/wireBlocksProcessor';
import { applyNormalizedEvents } from '@/modules/ai-chat/entities';
import mockReplayJson from '@/modules/ai-chat/features/connect/lib/mock.json';
import { buildAiChatMockReplayEvents } from '@/modules/ai-chat/features/connect/lib/mockReplay';

const traceIdMocks = vi.hoisted(() => ({
  next: 0,
}));

vi.mock('@/shared/lib/traceId', () => ({
  createTraceId: () => `trace-${traceIdMocks.next++}`,
}));

vi.mock('@/shared/ui/CitationMarkdown', () => ({
  default: ({ text }: { text: string }) => <div>{text}</div>,
}));

vi.mock('@/modules/resource', () => ({
  requestCitationJump: (payload: unknown) => ({ type: 'resource/requestCitationJump', payload }),
  useScopedDocNameMap: () => ({}),
}));

const ConnectedSidebar = () => {
  const renderMessages = useSelector((state: unknown) =>
    selectActiveSessionRenderMessages(state as never)
  );
  const uiState = useSelector((state: unknown) =>
    selectActiveSessionRenderUiState(state as never)
  );
  const sessionId = useSelector((state: unknown) => selectActiveSessionId(state as never));

  return (
    <SidebarChatMessages
      renderMessages={renderMessages}
      uiState={uiState}
      isHidden={false}
      sessionId={sessionId}
    />
  );
};

const createTestStore = () =>
  configureStore({
    reducer: {
      aiChat: aiChatReducer,
      resourceCenter: () => ({
        docNameMap: {},
        currentContext: {},
      }),
    },
  });

const replayMockEvents = ({
  store,
  sessionId,
  envelopes,
}: {
  store: ReturnType<typeof createTestStore>;
  sessionId: string;
  envelopes: ReturnType<typeof buildAiChatMockReplayEvents>;
}) => {
  const wireProcessor = createAiChatWireEventProcessor();
  envelopes.forEach((envelope) => {
    processSocketEnvelope({
      envelope,
      activeSessionId: sessionId,
      sessions: [],
      dispatch: store.dispatch,
      handlers: {
        handleSessionList: vi.fn(),
        handleSessionCreated: vi.fn(),
        handleSessionRenamed: vi.fn(),
        handleSessionRemoved: vi.fn(),
        handleSessionStatus: vi.fn(),
      },
      wireProcessor,
      dispatchWithStreamThrottle: (events) => {
        store.dispatch(applyNormalizedEvents(events));
      },
      enqueueUpdate: vi.fn(),
      shouldQueueUpdate: vi.fn(() => false),
      consumeContextReady: vi.fn(() => []),
      clearContextSession: vi.fn(),
      clearTextQueueBySession: vi.fn(),
      flushTextQueueBySession: vi.fn(),
      handleConnectionReplaced: vi.fn(),
    });
  });
};

const collectAssistantTextBlocks = (store: ReturnType<typeof createTestStore>) => {
  const renderMessages = selectActiveSessionRenderMessages(store.getState() as never);
  return renderMessages
    .filter((message) => message.sender === 'assistant')
    .flatMap((message) => message.blocks)
    .filter(
      (
        block
      ): block is Extract<(typeof renderMessages)[number]['blocks'][number], { kind: 'text' }> =>
        block.kind === 'text'
    )
    .map((block) => block.text);
};

describe('mock message flow', () => {
  it('通过 mock 模式输入后会自动在当前会话 UI 中输出 mock 文本', () => {
    traceIdMocks.next = 0;
    const store = createTestStore();
    store.dispatch(setActiveSessionId(TEMP_SESSION_ID));

    processSocketEnvelope({
      envelope: buildDebugMockEnvelope(TEMP_SESSION_ID),
      activeSessionId: TEMP_SESSION_ID,
      sessions: [],
      dispatch: store.dispatch,
      handlers: {
        handleSessionList: vi.fn(),
        handleSessionCreated: vi.fn(),
        handleSessionRenamed: vi.fn(),
        handleSessionRemoved: vi.fn(),
        handleSessionStatus: vi.fn(),
      },
      wireProcessor: createAiChatWireEventProcessor(),
      dispatchWithStreamThrottle: (events) => {
        store.dispatch(applyNormalizedEvents(events));
      },
      enqueueUpdate: vi.fn(),
      shouldQueueUpdate: vi.fn(() => false),
      consumeContextReady: vi.fn(() => []),
      clearContextSession: vi.fn(),
      clearTextQueueBySession: vi.fn(),
      flushTextQueueBySession: vi.fn(),
      handleConnectionReplaced: vi.fn(),
    });

    const markup = renderToStaticMarkup(
      <Provider store={store}>
        <ConnectedSidebar />
      </Provider>
    );

    expect(markup).toContain('mockcontent block: 这是一条本地调试模拟接收消息。');
  });

  it('回放 mock.json 时会产出消息，并且不会把 session:context 首包重复渲染两次', () => {
    const sessionId = 'mock-session';
    const replayEnvelopes = buildAiChatMockReplayEvents(mockReplayJson as never, sessionId);
    const firstContextEnvelope = replayEnvelopes.find((envelope) => envelope.cmd === 'session:context');
    const contextFirstPacketTexts = firstContextEnvelope
      ? (() => {
          traceIdMocks.next = 0;
          const contextOnlyStore = createTestStore();
          contextOnlyStore.dispatch(setActiveSessionId(sessionId));
          replayMockEvents({
            store: contextOnlyStore,
            sessionId,
            envelopes: [firstContextEnvelope],
          });
          return collectAssistantTextBlocks(contextOnlyStore);
        })()
      : [];

    traceIdMocks.next = 0;
    const fullReplayStore = createTestStore();
    fullReplayStore.dispatch(setActiveSessionId(sessionId));
    replayMockEvents({
      store: fullReplayStore,
      sessionId,
      envelopes: replayEnvelopes,
    });

    const fullReplayTexts = collectAssistantTextBlocks(fullReplayStore);
    const markup = renderToStaticMarkup(
      <Provider store={fullReplayStore}>
        <ConnectedSidebar />
      </Provider>
    );

    expect(markup.length).toBeGreaterThan(0);
    expect(fullReplayTexts.length).toBeGreaterThan(0);
    contextFirstPacketTexts.forEach((text) => {
      expect(fullReplayTexts.filter((candidate) => candidate.includes(text))).toHaveLength(1);
    });
  });
});
