// context 负责维护分步引导状态、步骤注册、手动推进与持久化状态。
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TourContext,
  type StepData,
  type TourFlowState,
} from './tourContext';

interface TourProviderProps {
  children: React.ReactNode;
  tags: string[];
}

const getSeenKey = (tag: string) => `tour_seen_${tag}`;

export const TourProvider: React.FC<TourProviderProps> = ({ children, tags }) => {
  const [steps, setSteps] = useState<StepData[]>([]);
  const [activeTagIndex, setActiveTagIndex] = useState<number>(0);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [flowState, setFlowState] = useState<TourFlowState>('idle');
  const [overlayVisible, setOverlayVisible] = useState(false);
  const stableTags = tags;

  const markTagAsSeen = useCallback((tag: string | null) => {
    if (!tag) return;
    localStorage.setItem(getSeenKey(tag), 'true');
  }, []);

  const activateRunning = useCallback(() => {
    setFlowState('running');
    setOverlayVisible(true);
  }, []);

  const activateCompleted = useCallback(() => {
    setFlowState('completed');
    setOverlayVisible(false);
  }, []);

  useEffect(() => {
    if (!stableTags.length) {
      const timer = window.setTimeout(() => {
        setActiveTagIndex(0);
        setActiveStepIndex(0);
        setFlowState('idle');
        setOverlayVisible(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    let firstUnseenTagIndex = 0;
    while (firstUnseenTagIndex < stableTags.length) {
      const tag = stableTags[firstUnseenTagIndex];
      const isSeen = localStorage.getItem(getSeenKey(tag));
      if (!isSeen) break;
      firstUnseenTagIndex++;
    }

    if (firstUnseenTagIndex < stableTags.length) {
      const timer = window.setTimeout(() => {
        setActiveTagIndex(firstUnseenTagIndex);
        setActiveStepIndex(0);
        activateRunning();
      }, 0);
      return () => window.clearTimeout(timer);
    } else {
      const timer = window.setTimeout(() => {
        setActiveTagIndex(0);
        setActiveStepIndex(0);
        activateCompleted();
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [stableTags, activateRunning, activateCompleted]);

  const registerStep = useCallback((step: StepData) => {
    setSteps((prev) => {
      const index = prev.findIndex((s) => s.id === step.id);
      if (index === -1) {
        return [...prev, step];
      }
      const next = [...prev];
      next[index] = step;
      return next;
    });
  }, []);

  const unregisterStep = useCallback((id: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const currentTagSteps = useMemo(() => {
    if (flowState !== 'running' || activeTagIndex >= stableTags.length) return [];
    const currentTag = stableTags[activeTagIndex];
    return steps
      .filter((step) => step.tag === currentTag)
      .sort((a, b) => a.order - b.order);
  }, [steps, flowState, activeTagIndex, stableTags]);

  const currentStep = useMemo(() => currentTagSteps[activeStepIndex] || null, [currentTagSteps, activeStepIndex]);
  const currentTag = stableTags[activeTagIndex] || null;

  const nextStep = useCallback(
    (count: number = 1) => {
      const stepAdvance = Math.max(0, count ?? 1);
      const safeIndex = Math.max(0, Math.min(activeStepIndex, currentTagSteps.length - 1));
      const nextIndex = safeIndex + stepAdvance;

      if (nextIndex < currentTagSteps.length) {
        setActiveStepIndex(nextIndex);
        activateRunning();
        return;
      }

      markTagAsSeen(currentTag);
      const nextTagIndex = activeTagIndex + 1;
      if (nextTagIndex < stableTags.length) {
        setActiveTagIndex(nextTagIndex);
        setActiveStepIndex(0);
        activateRunning();
        return;
      }

      activateCompleted();
    },
    [activeStepIndex, currentTagSteps.length, markTagAsSeen, currentTag, activeTagIndex, stableTags.length, activateRunning, activateCompleted]
  );

  const dismissTour = useCallback(() => {
    markTagAsSeen(currentTag);
    setFlowState('dismissed');
    setOverlayVisible(false);
  }, [markTagAsSeen, currentTag]);

  const finishTour = dismissTour;
  const isTourActive = flowState === 'running';

  return (
    <TourContext.Provider
      value={{
        registerStep,
        unregisterStep,
        currentStep,
        nextStep,
        dismissTour,
        finishTour,
        isTourActive,
        activeTag: currentTag,
        overlayVisible,
        flowState,
      }}
    >
      {children}
    </TourContext.Provider>
  );
};
