import { createContext } from 'react';
import type { ReactNode, RefObject } from 'react';

export type TourFlowState = 'idle' | 'running' | 'dismissed' | 'completed';

export type StepData = {
  id: string;
  tag: string;
  order: number;
  targetRef: RefObject<HTMLElement | null>;
  content: ReactNode;
  title?: string;
  actionLabel?: string;
};

export interface TourContextType {
  registerStep: (step: StepData) => void;
  unregisterStep: (id: string) => void;
  currentStep: StepData | null;
  nextStep: (count?: number) => void;
  dismissTour: () => void;
  finishTour: () => void;
  isTourActive: boolean;
  activeTag: string | null;
  overlayVisible: boolean;
  flowState: TourFlowState;
}

export const TourContext = createContext<TourContextType | null>(null);
