// TourStep 负责将页面元素注册为可被引导系统聚焦的步骤节点。
import React, { useEffect, useId, useRef } from 'react';
import { useTour } from './useTour';
import { cn } from './utils';

interface TourStepProps {
  tag: string;
  order: number;
  title?: string;
  actionLabel?: string;
  content: React.ReactNode;
  children: React.ReactElement;
  className?: string;
}

export const TourStep: React.FC<TourStepProps> = ({
  tag,
  order,
  title,
  actionLabel,
  content,
  children,
  className,
}) => {
  const id = useId();
  const { registerStep, unregisterStep } = useTour();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    elementRef.current = (wrapperRef.current?.firstElementChild as HTMLElement | null) ?? null;
    registerStep({
      id,
      tag,
      order,
      targetRef: elementRef,
      content,
      title,
      actionLabel,
    });

    return () => {
      unregisterStep(id);
    };
  }, [id, tag, order, content, title, actionLabel, registerStep, unregisterStep]);

  return (
    <div
      ref={wrapperRef}
      className={cn('contents', className)}
    >
      {children}
    </div>
  );
};
