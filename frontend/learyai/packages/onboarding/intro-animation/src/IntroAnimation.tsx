// IntroAnimation 负责在首次进入工作区时展示概念化全屏介绍动画，支持随全局主题自动换肤。
import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight } from 'lucide-react';
import { useTheme } from '@/shared/contexts/useTheme';

export interface ConceptItem {
  term: string;
  description: string;
  icon?: ReactNode;
}

interface IntroAnimationProps {
  items: ConceptItem[];
  onComplete?: () => void;
  autoPlayDuration?: number; // Duration in ms per slide, 0 to disable auto-play
}

export function IntroAnimation({ 
  items, 
  onComplete, 
  autoPlayDuration = 5000 
}: IntroAnimationProps) {
  const { isDarkMode } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

  const theme = isDarkMode
    ? {
        containerBg: 'bg-[#0f1012]',
        textPrimary: 'text-white',
        textSecondary: 'text-gray-400',
        progressActive: 'bg-emerald-500',
        progressInactive: 'bg-white/10',
        blurTop: 'bg-emerald-600/10',
        blurBottom: 'bg-teal-600/10',
        skipText: 'text-gray-500 hover:text-white',
        controlBorder: 'border border-white/10',
        controlHover: 'hover:bg-white/5',
        controlIcon: 'text-white',
        circleTrack: 'text-white/10',
      }
    : {
        containerBg: 'bg-white',
        textPrimary: 'text-slate-900',
        textSecondary: 'text-slate-600',
        progressActive: 'bg-emerald-500',
        progressInactive: 'bg-slate-200',
        blurTop: 'bg-emerald-300/30',
        blurBottom: 'bg-teal-200/40',
        skipText: 'text-slate-500 hover:text-slate-900',
        controlBorder: 'border border-slate-200',
        controlHover: 'hover:bg-slate-50',
        controlIcon: 'text-slate-900',
        circleTrack: 'text-slate-200',
      };

  const handleComplete = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      onComplete?.();
    }, 800); // Wait for exit animation
  }, [onComplete]);

  const handleNext = useCallback(() => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      handleComplete();
    }
  }, [currentIndex, items.length, handleComplete]);

  useEffect(() => {
    if (autoPlayDuration > 0 && !isExiting) {
      const timer = setTimeout(handleNext, autoPlayDuration);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, autoPlayDuration, handleNext, isExiting]);

  // If no items, complete immediately
  if (!items || items.length === 0) return null;

  return (
    <AnimatePresence mode="wait">
      {!isExiting && (
        <motion.div
          key="intro-container"
          className={`fixed inset-0 z-50 flex items-center justify-center ${theme.containerBg} ${theme.textPrimary} overflow-hidden`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.8, ease: "easeInOut" } }}
        >
          {/* Atmospheric Background */}
          <div className="absolute inset-0 z-0">
            <motion.div 
              className={`absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full ${theme.blurTop} blur-[120px]`}
              animate={{ 
                x: [0, 100, 0], 
                y: [0, 50, 0],
                scale: [1, 1.2, 1]
              }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            />
            <motion.div 
              className={`absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full ${theme.blurBottom} blur-[100px]`}
              animate={{ 
                x: [0, -50, 0], 
                y: [0, -100, 0], 
                scale: [1, 1.1, 1]
              }}
              transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            />
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 brightness-100 contrast-150 mix-blend-overlay"></div>
          </div>

          {/* Content Container */}
          <div className="relative z-10 w-full max-w-4xl px-8 md:px-16">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                className="flex flex-col items-start"
                initial="initial"
                animate="animate"
                exit="exit"
              >
                {/* Progress Indicator */}
                <motion.div 
                  className="flex gap-2 mb-8"
                  variants={{
                    initial: { opacity: 0 },
                    animate: { opacity: 1, transition: { delay: 0.2 } },
                    exit: { opacity: 0 }
                  }}
                >
                  {items.map((_, idx) => (
                    <div 
                      key={idx} 
                      className={`h-1 rounded-full transition-all duration-500 ${idx === currentIndex ? `w-12 ${theme.progressActive}` : `w-2 ${theme.progressInactive}`}`}
                    />
                  ))}
                </motion.div>

                {/* Term / Title */}
                <div className="overflow-hidden">
                  <motion.h1 
                    className={`text-6xl md:text-8xl font-bold tracking-tighter mb-6 ${theme.textPrimary}`}
                    variants={{
                      initial: { y: 100, opacity: 0 },
                      animate: { 
                        y: 0, 
                        opacity: 1,
                        transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
                      },
                      exit: { 
                        y: -50, 
                        opacity: 0,
                        transition: { duration: 0.4, ease: "easeIn" }
                      }
                    }}
                  >
                    {items[currentIndex].term}
                  </motion.h1>
                </div>

                {/* Description */}
                <motion.p 
                  className={`text-xl md:text-2xl ${theme.textSecondary} font-light leading-relaxed max-w-2xl`}
                  variants={{
                    initial: { opacity: 0, y: 20, filter: 'blur(10px)' },
                    animate: { 
                      opacity: 1, 
                      y: 0, 
                      filter: 'blur(0px)',
                      transition: { delay: 0.2, duration: 0.8 }
                    },
                    exit: { 
                      opacity: 0, 
                      y: -10, 
                      filter: 'blur(10px)',
                      transition: { duration: 0.3 }
                    }
                  }}
                >
                  {items[currentIndex].description}
                </motion.p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Controls */}
          <div className="absolute bottom-12 right-12 z-20 flex items-center gap-6">
            <button 
              onClick={handleComplete}
              className={`${theme.skipText} text-sm uppercase tracking-widest transition-colors`}
            >
              Skip Intro
            </button>
            
            <button 
              onClick={handleNext}
              className={`group relative flex items-center justify-center w-16 h-16 rounded-full ${theme.controlBorder} ${theme.controlHover} transition-all`}
            >
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="48"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  className={theme.circleTrack}
                />
                {autoPlayDuration > 0 && (
                  <motion.circle
                    key={currentIndex}
                    cx="50"
                    cy="50"
                    r="48"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-emerald-500"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: autoPlayDuration / 1000, ease: "linear" }}
                  />
                )}
              </svg>
              <ChevronRight className={`w-6 h-6 ${theme.controlIcon} group-hover:translate-x-0.5 transition-transform`} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
