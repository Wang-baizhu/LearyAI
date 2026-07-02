// useImagePreviewJump 负责以可重试状态机方式完成图片预览跳页。
import React from 'react';
import {
  findNearestPreviewPageNumber,
  resolvePreviewPageTop,
} from '../lib/imagePreviewViewportPosition';

const MAX_JUMP_ATTEMPTS = 4;
const JUMP_RETRY_DELAY_MS = 80;

interface PendingJumpState {
  attempts: number;
  key: string;
  pageNumber: number;
}

interface UseImagePreviewJumpOptions {
  jumpToPage?: number;
  jumpToken?: number;
  onJumpHandled?: () => void;
  pages: Array<{ pageNumber: number; url: string }>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  setCurrentPageNumber: React.Dispatch<React.SetStateAction<number>>;
}

export const useImagePreviewJump = ({
  jumpToPage,
  jumpToken,
  onJumpHandled,
  pages,
  scrollContainerRef,
  setCurrentPageNumber,
}: UseImagePreviewJumpOptions) => {
  const handledJumpKeyRef = React.useRef<string | null>(null);
  const pendingJumpRef = React.useRef<PendingJumpState | null>(null);
  const runJumpAttemptRef = React.useRef<(pendingJump: PendingJumpState) => void>(() => undefined);
  const retryTimerRef = React.useRef<number | null>(null);
  const animationFrameRef = React.useRef<number | null>(null);
  const waitForImagesCleanupRef = React.useRef<(() => void) | null>(null);

  const clearWaitingImages = React.useCallback(() => {
    waitForImagesCleanupRef.current?.();
    waitForImagesCleanupRef.current = null;
  }, []);

  const clearScheduledWork = React.useCallback(() => {
    if (retryTimerRef.current != null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (animationFrameRef.current != null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    clearWaitingImages();
  }, [clearWaitingImages]);

  const markHandled = React.useCallback((pendingJump: PendingJumpState) => {
    handledJumpKeyRef.current = pendingJump.key;
    pendingJumpRef.current = null;
    clearScheduledWork();
    setCurrentPageNumber(pendingJump.pageNumber);
    onJumpHandled?.();
  }, [clearScheduledWork, onJumpHandled, setCurrentPageNumber]);

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
      `[data-page-number="${latestPendingJump.pageNumber}"]`
    );
    if (!targetElement) {
      return;
    }

    const targetTop = resolvePreviewPageTop(targetElement);
    container.scrollTo({ top: targetTop, behavior: 'auto' });
    animationFrameRef.current = window.requestAnimationFrame(() => {
      animationFrameRef.current = null;
      const resolvedPageNumber = findNearestPreviewPageNumber(container);
      if (resolvedPageNumber === latestPendingJump.pageNumber) {
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
    if (!jumpToPage) {
      pendingJumpRef.current = null;
      clearScheduledWork();
      return;
    }

    const jumpKey = `${jumpToPage}-${jumpToken ?? 'no-token'}`;
    if (handledJumpKeyRef.current === jumpKey) {
      return;
    }

    const existingPendingJump = pendingJumpRef.current;
    const nextPendingJump = existingPendingJump?.key === jumpKey
      ? existingPendingJump
      : {
        attempts: 0,
        key: jumpKey,
        pageNumber: jumpToPage,
      };

    if (existingPendingJump?.key !== jumpKey) {
      clearScheduledWork();
      pendingJumpRef.current = nextPendingJump;
    }

    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }
    const targetElement = container.querySelector<HTMLElement>(`[data-page-number="${jumpToPage}"]`);
    if (!targetElement) {
      return;
    }

    const loadedPageElements = Array.from(container.querySelectorAll<HTMLElement>('[data-page-number]'))
      .filter((element) => Number(element.dataset.pageNumber) <= jumpToPage);
    const pendingImages = loadedPageElements
      .map((element) => element.querySelector('img'))
      .filter((image): image is HTMLImageElement => Boolean(image && !image.complete));

    if (pendingImages.length > 0) {
      clearWaitingImages();
      const listeners = pendingImages.map((image) => {
        const handleSettled = () => {
          const activePendingJump = pendingJumpRef.current;
          if (!activePendingJump || activePendingJump.key !== jumpKey) {
            return;
          }
          if (!pendingImages.every((pendingImage) => pendingImage.complete)) {
            return;
          }
          clearWaitingImages();
          scheduleAttempt(activePendingJump);
        };
        image.addEventListener('load', handleSettled);
        image.addEventListener('error', handleSettled);
        return () => {
          image.removeEventListener('load', handleSettled);
          image.removeEventListener('error', handleSettled);
        };
      });
      waitForImagesCleanupRef.current = () => {
        listeners.forEach((cleanup) => cleanup());
      };
      return;
    }

    scheduleAttempt(nextPendingJump);
  }, [
    clearScheduledWork,
    clearWaitingImages,
    jumpToPage,
    jumpToken,
    pages,
    scheduleAttempt,
    scrollContainerRef,
  ]);

  React.useEffect(() => clearScheduledWork, [clearScheduledWork]);
};
