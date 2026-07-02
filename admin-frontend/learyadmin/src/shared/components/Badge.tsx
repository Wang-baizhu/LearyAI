/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { cn } from '@/shared/utils/cn';

export const Badge: React.FC<{
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  className?: string;
}> = ({ children, variant = 'neutral', className }) => {
  const variants = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    warning: 'bg-amber-50 text-amber-700 border-amber-100',
    error: 'bg-rose-50 text-rose-700 border-rose-100',
    info: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    neutral: 'bg-zinc-50 text-zinc-700 border-zinc-100',
  };

  return (
    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold border uppercase tracking-wider", variants[variant], className)}>
      {children}
    </span>
  );
};
