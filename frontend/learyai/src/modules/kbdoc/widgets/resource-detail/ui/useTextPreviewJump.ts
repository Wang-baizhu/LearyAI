// useTextPreviewJump 负责以可重试状态机方式完成文本预览跳段。
import React from 'react';
import {
  findNearestPreviewItemNumber,
  PREVIEW_VIEWPORT_TOP_OFFSET,
  resolvePreviewItemTop,
} from '../lib/previewViewportPosition';

const MAX_JUMP_ATTEMPTS = 4;
const JUMP_RETRY_DELAY_MS = 80;

interface PendingJumpState {
  attempts: number;
  chunkSec: number;
  key: string;
}

interface UseTextPreviewJumpOptions {
  chunks: Array<{ chunkSec: number; text: string }>;
  jumpToChunk?: number;
  jumpToken?: number;
  onJumpHandled?: () => void;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  setCurrentChunkSec: React.Dispatch<React.SetStateAction<number>>;
}

export const useTextPreviewJump = ({
  chunks,
  jumpToChunk,
  jumpToken,
  onJumpHandled,
  scrollContainerRef,
  setCurrentChunkSec,
}: UseTextPreviewJumpOptions) => {
  const handledJumpKeyRef = React.useRef<string | null>(null);
  const pendingJumpRef = React.useRef<PendingJumpState | null>(null);
  const runJumpAttemptRef = React.useRef<(pendingJump: PendingJumpState) => void>(() => undefined);
  const retryTimerRef = React.useRef<number | null>(null);
  const animationFrameRef = React.useRef<number | null>(null);

  const clearScheduledWork = React.useCallback(() => {
    if (retryTimerRef.current != null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (animationFrameRef.current != null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const markHandled = React.useCallback((pendingJump: PendingJumpState) => {
    handledJumpKeyRef.current = pendingJump.key;
    pendingJumpRef.current = null;
    clearScheduledWork();
    setCurrentChunkSec(pendingJump.chunkSec);
    onJumpHandled?.();
  }, [clearScheduledWork, onJumpHandled, setCurrentChunkSec]);

  const runJumpAttempt = React.useCallback((pendingJump: PendingJumpState) => {
    const latestPendingJump = pendingJumpRef.current;
    if (!latestPendingJump || latestPendingJump.key !== pendingJump.key) {
      return;
    }

    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }
    const targetElement = container.querySelector<HTMLElement>(
      `[data-chunk-sec="${latestPendingJump.chunkSec}"]`
    );
    if (!targetElement) {
      return;
    }

    const targetTop = resolvePreviewItemTop(targetElement, PREVIEW_VIEWPORT_TOP_OFFSET);
    container.scrollTo({ top: targetTop, behavior: 'auto' });
    animationFrameRef.current = window.requestAnimationFrame(() => {
      animationFrameRef.current = null;
      const resolvedChunkSec = findNearestPreviewItemNumber(
        container,
        'chunkSec',
        PREVIEW_VIEWPORT_TOP_OFFSET
      );
      if (resolvedChunkSec === latestPendingJump.chunkSec) {
        markHandled(latestPendingJump);
        return;
      }
      if (latestPendingJump.attempts >= MAX_JUMP_ATTEMPTS) {
        return;
      }
      const nextPendingJump = {
        ...latestPendingJump,
        attempts: latestPendingJump.attempts + 1,
      };
      pendingJumpRef.current = nextPendingJump;
      retryTimerRef.current = window.setTimeout(() => {
        retryTimerRef.current = null;
        runJumpAttemptRef.current(nextPendingJump);
      }, JUMP_RETRY_DELAY_MS);
    });
  }, [markHandled, scrollContainerRef]);

  React.useEffect(() => {
    runJumpAttemptRef.current = runJumpAttempt;
  }, [runJumpAttempt]);

  const scheduleAttempt = React.useCallback((pendingJump: PendingJumpState) => {
    if (animationFrameRef.current != null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    animationFrameRef.current = window.requestAnimationFrame(() => {
      animationFrameRef.current = null;
      runJumpAttempt(pendingJump);
    });
  }, [runJumpAttempt]);

  React.useEffect(() => {
    if (!jumpToChunk) {
      pendingJumpRef.current = null;
      clearScheduledWork();
      return;
    }

    const jumpKey = `${jumpToChunk}-${jumpToken ?? 'no-token'}`;
    if (handledJumpKeyRef.current === jumpKey) {
      return;
    }

    const existingPendingJump = pendingJumpRef.current;
    const nextPendingJump = existingPendingJump?.key === jumpKey
      ? existingPendingJump
      : {
        attempts: 0,
        chunkSec: jumpToChunk,
        key: jumpKey,
      };

    if (existingPendingJump?.key !== jumpKey) {
      clearScheduledWork();
      pendingJumpRef.current = nextPendingJump;
    }

    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }
    const targetElement = container.querySelector<HTMLElement>(`[data-chunk-sec="${jumpToChunk}"]`);
    if (!targetElement) {
      return;
    }

    scheduleAttempt(nextPendingJump);
  }, [
    chunks,
    clearScheduledWork,
    jumpToChunk,
    jumpToken,
    scheduleAttempt,
    scrollContainerRef,
  ]);

  React.useEffect(() => clearScheduledWork, [clearScheduledWork]);
};
