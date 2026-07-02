// ElectronAuthCompletePage 负责承接 Electron 登录回跳完成页。
import React from 'react';

const ElectronAuthCompletePage: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center p-6 bg-white dark:bg-[#121212] text-slate-900 dark:text-[#e0e0e0]">
    <div className="w-full max-w-lg rounded-3xl border border-slate-200 dark:border-[#2a2a2a] bg-white/90 dark:bg-[#181818] px-8 py-10 shadow-2xl">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-teal">Electron Auth</p>
      <h1 className="mt-4 text-3xl font-bold">登录已完成</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
        可以关闭此窗口并返回模板插件工作台。Electron 会自动刷新当前会话。
      </p>
    </div>
  </div>
);

export default ElectronAuthCompletePage;
