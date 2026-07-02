// className 负责提供白板模块内统一的 Tailwind 类名合并能力。
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const mergeClassName = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};
