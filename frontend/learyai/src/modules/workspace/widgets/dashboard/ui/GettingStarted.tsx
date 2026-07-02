// GettingStarted 负责展示入门指南与资源入口。
import React from 'react';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';

const GettingStarted: React.FC = () => {
  return (
    <section className="bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] rounded-2xl p-6 h-full flex flex-col gap-6">
      <div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">入门指南</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          从快速上手到详细设置，点击下方链接跳转查看~
        </p>
      </div>

      <div className="relative rounded-2xl bg-slate-50 dark:bg-[#121212]/50 border border-slate-100 dark:border-[#2a2a2a] p-5 group hover:border-accent transition-colors cursor-pointer">
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-semibold tracking-wide text-slate-800 dark:text-white">快速上手</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">查看本指南可快速上手本应用！</p>
        </div>
        <a className="absolute top-5 right-5 inline-flex items-center text-accent group-hover:text-primary transition-colors" href="#">
          <MaterialIcon name="arrow_forward" className="text-[18px]" />
        </a>
      </div>

      <div className="mt-auto pt-6 border-t border-slate-100 dark:border-[#2a2a2a] flex flex-col gap-4">
        <p className="text-xs text-slate-400 uppercase font-bold tracking-widest">其他资源</p>
        <div className="flex flex-wrap gap-2">
          {['API文档', '视频教程', '社区反馈'].map((item) => (
            <button
              key={item}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-[#1a1a1a] text-slate-600 dark:text-[#c7d8db] hover:bg-slate-200 dark:hover:bg-[#2a2a2a] transition-colors"
            >
              {item}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default GettingStarted;
