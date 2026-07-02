// useTextStreamThrottle 负责将高频流式归一化事件合批到浏览器帧级分发。
import { useCallback, useEffect, useRef } from 'react';
import type { AppDispatch } from '@/app/store';
import { applyNormalizedEvents } from '../../../../entities';
import type { NormalizedEvent } from '../../../../entities';

const STREAM_DISPATCH_INTERVAL_MS = 16;

const buildAssistantTextEvent = (agentSessionId: string, text: string): NormalizedEvent => ({
  type: 'message.blocks',
  agentSessionId,
  blocks: [{ type: 'text', text }],
  sender: 'assistant',
});

const findIncompleteCitationStart = (text: string) => {
  const scanWindow = text.slice(-1024);
  for (let index = scanWindow.length - 1; index >= 0; index -= 1) {
    const char = scanWindow[index];
    if (char !== '(' && char !== '（') continue;
    const suffix = scanWindow.slice(index);
    if (!suffix.includes('[') || /[)）]/.test(suffix)) {
      continue;
    }
    return text.length - scanWindow.length + index;
  }
  return -1;
};

export const splitStableMarkdownText = (text: string) => {
  if (!text) {
    return { flushable: '', pending: '' };
  }

  let flushable = text;
  let pending = '';

  const incompleteCitationStart = findIncompleteCitationStart(flushable);
  if (incompleteCitationStart >= 0) {
    pending = flushable.slice(incompleteCitationStart);
    flushable = flushable.slice(0, incompleteCitationStart);
  }

  if (!flushable.endsWith('\n')) {
    const lastNewlineIndex = flushable.lastIndexOf('\n');
    const lastLine = flushable.slice(lastNewlineIndex + 1);
    if (lastLine.trimStart().startsWith('|')) {
      pending = `${lastLine}${pending}`;
      flushable = flushable.slice(0, lastNewlineIndex + 1);
    }
  }

  return {
    flushable,
    pending,
  };
};

const areAssistantTextOnlyBlocks = (
  event: NormalizedEvent
): event is Extract<NormalizedEvent, { type: 'message.blocks' }> =>
  event.type === 'message.blocks' &&
  (event.sender ?? 'assistant') === 'assistant' &&
  event.blocks.length > 0 &&
  event.blocks.every((block) => block.type === 'text');

export const useTextStreamThrottle = (dispatch: AppDispatch) => {
  const queuedEventsRef = useRef<NormalizedEvent[]>([]);
  const flushTimerRef = useRef<number | null>(null);
  const pendingTextBySessionRef = useRef(new Map<string, string>());

  const clearFlushTimer = useCallback(() => {
    if (flushTimerRef.current === null) return;
    window.clearTimeout(flushTimerRef.current);
    flushTimerRef.current = null;
  }, []);

  const flushQueuedEvents = useCallback(() => {
    clearFlushTimer();
    const events = queuedEventsRef.current;
    if (events.length === 0) return;
    queuedEventsRef.current = [];
    dispatch(applyNormalizedEvents(events));
  }, [clearFlushTimer, dispatch]);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current !== null) return;
    flushTimerRef.current = window.setTimeout(flushQueuedEvents, STREAM_DISPATCH_INTERVAL_MS);
  }, [flushQueuedEvents]);

  const flushPendingSessionText = useCallback(
    (agentSessionId: string, targetEvents: NormalizedEvent[]) => {
      const pending = pendingTextBySessionRef.current.get(agentSessionId);
      if (!pending) return;
      pendingTextBySessionRef.current.delete(agentSessionId);
      targetEvents.push(buildAssistantTextEvent(agentSessionId, pending));
    },
    []
  );

  const rescheduleFlushForRemainingEvents = useCallback(() => {
    if (queuedEventsRef.current.length === 0) return;
    flushTimerRef.current = window.setTimeout(flushQueuedEvents, STREAM_DISPATCH_INTERVAL_MS);
  }, [flushQueuedEvents]);

  const normalizeStreamingEvents = useCallback(
    (events: NormalizedEvent[]) => {
      const normalizedEvents: NormalizedEvent[] = [];

      events.forEach((event) => {
        if (!areAssistantTextOnlyBlocks(event)) {
          flushPendingSessionText(event.agentSessionId, normalizedEvents);
          normalizedEvents.push(event);
          return;
        }

        const incomingText = event.blocks
          .map((block) => (block.type === 'text' ? block.text : ''))
          .join('');
        const currentPending = pendingTextBySessionRef.current.get(event.agentSessionId) ?? '';
        const { flushable, pending } = splitStableMarkdownText(`${currentPending}${incomingText}`);

        if (pending) {
          pendingTextBySessionRef.current.set(event.agentSessionId, pending);
        } else {
          pendingTextBySessionRef.current.delete(event.agentSessionId);
        }

        if (!flushable) {
          return;
        }

        normalizedEvents.push({
          ...event,
          blocks: [{ type: 'text', text: flushable }],
        });
      });

      return normalizedEvents;
    },
    [flushPendingSessionText]
  );

  const clearTextQueueBySession = useCallback(
    (agentSessionId: string) => {
      queuedEventsRef.current = queuedEventsRef.current.filter(
        (event) => event.agentSessionId !== agentSessionId
      );
      pendingTextBySessionRef.current.delete(agentSessionId);
      if (queuedEventsRef.current.length === 0) {
        clearFlushTimer();
      }
    },
    [clearFlushTimer]
  );

  const clearAllTextQueue = useCallback(() => {
    queuedEventsRef.current = [];
    pendingTextBySessionRef.current.clear();
    clearFlushTimer();
  }, [clearFlushTimer]);

  const flushTextQueueBySession = useCallback(
    (agentSessionId: string) => {
      clearFlushTimer();
      const nextQueuedEvents: NormalizedEvent[] = [];
      const sessionEvents: NormalizedEvent[] = [];

      queuedEventsRef.current.forEach((event) => {
        if (event.agentSessionId === agentSessionId) {
          sessionEvents.push(event);
          return;
        }
        nextQueuedEvents.push(event);
      });

      queuedEventsRef.current = nextQueuedEvents;
      flushPendingSessionText(agentSessionId, sessionEvents);

      if (nextQueuedEvents.length > 0) {
        rescheduleFlushForRemainingEvents();
      }

      if (sessionEvents.length > 0) {
        dispatch(applyNormalizedEvents(sessionEvents));
      }
    },
    [clearFlushTimer, dispatch, flushPendingSessionText, rescheduleFlushForRemainingEvents]
  );

  const dispatchWithStreamThrottle = useCallback(
    (events: NormalizedEvent[]) => {
      if (events.length === 0) return;
      queuedEventsRef.current = [...queuedEventsRef.current, ...normalizeStreamingEvents(events)];
      scheduleFlush();
    },
    [normalizeStreamingEvents, scheduleFlush]
  );

  useEffect(() => clearAllTextQueue, [clearAllTextQueue]);

  return {
    dispatchWithStreamThrottle,
    clearTextQueueBySession,
    flushTextQueueBySession,
    clearAllTextQueue,
  };
};
