// SkeletonLoader 负责渲染可配置的骨架加载条，供模块复用。
import React from 'react';

interface SkeletonLoaderProps {
  barCount?: number;
  maxWidths?: string[];
  delayBase?: number;
  speed?: number;
  barHeightClassName?: string;
  className?: string;
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  barCount = 9,
  maxWidths = ['95%', '70%', '55%', '65%', '75%', '60%', '35%', '20%', '15%'],
  delayBase = 120,
  speed = 1,
  barHeightClassName = 'h-3',
  className = '',
}) => {
  const widths = Array.from({ length: barCount }, (_, i) => maxWidths[i % maxWidths.length]);

  return (
    <div className={`flex w-full flex-col gap-3 ${className}`}>
      {widths.map((width, index) => (
        <div
          key={index}
          className={`${barHeightClassName} rounded-full bg-slate-200/70 animate-pulse dark:bg-slate-700/50`}
          style={{
            width,
            animationDelay: `${index * delayBase}ms`,
            animationDuration: `${0.8 * speed}s`,
          }}
        />
      ))}
    </div>
  );
};

export default SkeletonLoader;
