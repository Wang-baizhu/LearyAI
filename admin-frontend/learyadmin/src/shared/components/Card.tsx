/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { cn } from '@/shared/utils/cn';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: React.ReactNode;
  extra?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ title, extra, children, className, ...props }) => {
  return (
    <div className={cn("bg-white rounded-xl border border-black/5 shadow-sm overflow-hidden", className)} {...props}>
      {(title || extra) && (
        <div className="px-6 py-4 border-bottom border-black/5 flex items-center justify-between">
          {title && <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>}
          {extra && <div className="text-sm">{extra}</div>}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
};

export const StatCard: React.FC<{
  label: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  trend?: { value: number; isUp: boolean };
}> = ({ label, value, description, icon, trend }) => {
  return (
    <Card className="flex flex-col gap-1">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{label}</span>
        {icon && <div className="text-zinc-400">{icon}</div>}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-zinc-900">{value}</span>
        {trend && (
          <span className={cn("text-xs font-medium", trend.isUp ? "text-emerald-600" : "text-rose-600")}>
            {trend.isUp ? '↑' : '↓'} {trend.value}%
          </span>
        )}
      </div>
      {description && <p className="text-xs text-zinc-400 mt-1">{description}</p>}
    </Card>
  );
};
