// TourOverlay 负责渲染引导聚光遮罩与步骤提示气泡。
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useTour } from './useTour';
import { X } from 'lucide-react';

export const TourOverlay: React.FC = () => {
  const { currentStep, nextStep, dismissTour, overlayVisible } = useTour();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const updateState = () => {
      if (currentStep?.targetRef.current) {
        const rect = currentStep.targetRef.current.getBoundingClientRect();
        setTargetRect(rect);
      } else {
        setTargetRect(null);
      }
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };

    updateState();
    window.addEventListener('resize', updateState);
    window.addEventListener('scroll', updateState, true);

    return () => {
      window.removeEventListener('resize', updateState);
      window.removeEventListener('scroll', updateState, true);
    };
  }, [currentStep]);

  if (!overlayVisible || !currentStep || !targetRect) return null;

  // Calculate tooltip position
  const TOOLTIP_WIDTH = 320;
  const PADDING = 12;
  const ESTIMATED_HEIGHT = 250;

  let tooltipLeft = targetRect.left;

  if (tooltipLeft + TOOLTIP_WIDTH + PADDING > windowSize.width) {
    tooltipLeft = windowSize.width - TOOLTIP_WIDTH - PADDING;
  }

  if (tooltipLeft < PADDING) {
    tooltipLeft = PADDING;
  }

  const spaceBelow = windowSize.height - (targetRect.bottom + PADDING);
  const spaceAbove = targetRect.top - PADDING;

  const showAbove = spaceBelow < ESTIMATED_HEIGHT && spaceAbove > spaceBelow;

  const tooltipTop = showAbove ? targetRect.top - PADDING : targetRect.bottom + PADDING;
  const tooltipYTransform = showAbove ? '-100%' : '0%';

  const arrowSize = 6;
  const targetCenterX = targetRect.left + targetRect.width / 2;
  let arrowX = targetCenterX - tooltipLeft - arrowSize;

  const tooltipRadius = 12;
  if (arrowX < tooltipRadius) arrowX = tooltipRadius;
  if (arrowX > TOOLTIP_WIDTH - tooltipRadius - arrowSize * 2) arrowX = TOOLTIP_WIDTH - tooltipRadius - arrowSize * 2;

  const outerPath = `M0,0 H${windowSize.width} V${windowSize.height} H0 Z`;
  const holePath = `M${targetRect.left - 4},${targetRect.top - 4} h${targetRect.width + 8} v${targetRect.height + 8} h-${targetRect.width + 8} Z`;
  const pathD = `${outerPath} ${holePath}`;

  // Theme Color from the image (Teal)
  const THEME_COLOR = '#00C1A3';

  return createPortal(
    <div className="fixed inset-0 z-[9999] pointer-events-auto">
      <div
        className="absolute inset-0"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      />
      <svg className="absolute inset-0 w-full h-full text-black/60 fill-current pointer-events-none">
        <motion.path
          initial={false}
          animate={{ d: pathD }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 30,
          }}
          fillRule="evenodd"
        />
      </svg>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep.id}
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{
            opacity: 1,
            scale: 1,
            left: tooltipLeft,
            top: tooltipTop,
            y: tooltipYTransform,
            bottom: 'auto',
          }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="absolute z-10 pointer-events-auto w-72 md:w-80 max-w-[calc(100vw-24px)]"
        >
          <div className="relative bg-white rounded-xl shadow-2xl border border-white/20">
            <div
              className={`absolute w-3 h-3 bg-white rotate-45 border-l border-t border-white/20 ${showAbove ? '-bottom-1.5 border-b border-r border-l-0 border-t-0' : '-top-1.5'}`}
              style={{ left: arrowX }}
            />

            <div className="overflow-hidden rounded-xl">
              <div className="p-5">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-bold text-gray-900">{currentStep.title || '提示'}</h3>
                  <button onClick={dismissTour} className="text-gray-400 hover:text-gray-600 transition-colors">
                    <X size={18} />
                  </button>
                </div>

                <div className="text-gray-600 text-sm leading-relaxed mb-4">{currentStep.content}</div>

                <div className="flex items-center justify-end pt-2 border-t border-gray-100 mt-2">
                  <button
                    onClick={() => nextStep()}
                    className="px-4 py-1.5 text-xs font-medium text-white rounded-lg transition-colors shadow-sm"
                    style={{ backgroundColor: THEME_COLOR }}
                  >
                    {currentStep.actionLabel ?? '知道了'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body
  );
};
