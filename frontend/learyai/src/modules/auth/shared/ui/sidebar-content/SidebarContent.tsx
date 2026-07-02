// SidebarContent 提供登录流程中左侧说明文案与演示状态提示，与布局分离。
import React from 'react';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';
import type { AuthView } from '../../types';

interface SidebarContentProps {
  view: AuthView;
}

const SidebarContent: React.FC<SidebarContentProps> = ({ view }) => {
  const header = (
      <div className="flex items-center gap-3 mb-12">
        <img
          src="/icon-animate.svg"
          alt="Leary AI"
          className="w-10 h-10 object-contain"
        />
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-[#e0e0e0] leading-none">Leary AI</h1>
        </div>
      </div>
  );

  if (view === 'login') {
    return (
      <div className="flex-1 flex flex-col">
        {header}
        <div className="space-y-6 flex-1">
          <div className="flex flex-col gap-1 max-w-[85%] ml-auto">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-2 text-right">用户</span>
            <div className="bg-brand-teal dark:bg-teal-800 p-4 rounded-2xl rounded-tr-none text-white ai-glow">
              <p className="text-sm leading-relaxed">你好，你能告诉我你是谁？你能做什么吗？</p>
            </div>
          </div>
          <div className="flex flex-col gap-1 max-w-[85%]">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-2">AI 助手</span>
            <div className="bg-white dark:bg-[#1a1a1a] p-4 rounded-2xl rounded-tl-none border border-slate-200 dark:border-[#2a2a2a] shadow-sm">
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed ">
                思考中... <br />
                你好！我是 Leary AI，一个擅长检索知识库并高效完成任务的 AI Agent。<br />
                我能做知识库检索、制定可视化样式...以及更多！<br />
                如果你有任何问题或需要帮助完成某项任务，请随时告诉我！
              </p>
            </div>
          </div>
        </div>
        <div className="mt-8">
            <div className="flex items-center gap-4 p-4 bg-white dark:bg-[#1a1a1a] rounded-2xl border border-slate-200 dark:border-[#2a2a2a] shadow-sm">
              <div className="flex-1 bg-slate-50 dark:bg-[#121212] h-10 rounded-lg flex items-center px-4">
              <span className="text-slate-400 text-sm">向 AI 提问任何问题...</span>
            </div>
            <div className="bg-brand-teal p-2 rounded-lg cursor-pointer hover:bg-teal-700 transition-colors">
              <MaterialIcon name="send" className="text-white text-sm" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {header}
      <div className="space-y-8 flex-1">
        <div className="flex gap-5 group">
          <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 transition-transform group-hover:scale-110">
            <MaterialIcon name="smart_toy" className="text-3xl" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-1">智能 AI 助手</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
              我们的上下文智能助手实时分析你的当前目标与文档，为你提供主动洞察。
            </p>
          </div>
        </div>

        <div className="flex gap-5 group">
          <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 transition-transform group-hover:scale-110">
            <MaterialIcon name="hub" className="text-3xl" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-1">智能资源中心</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
              在统一的空间中轻松管理知识库、思维导图与参考文档。
            </p>
          </div>
        </div>

        <div className="mt-8 p-6 rounded-2xl border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a]/60 ai-glow relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">推荐能力</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-[#1a1a1a] text-slate-500 dark:text-[#e0e0e0] font-mono">
              KB-092
            </span>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <MaterialIcon name="auto_stories" className="text-teal-500" />
            <h4 className="font-bold text-slate-900 dark:text-white">自动分析</h4>
          </div>
          <p className="text-xs text-slate-500 dark:text-[#a0a0a0] leading-relaxed">
            正在扫描知识库... 文档建议新神经网络引擎。每次请求限制在 5 万个 token。
          </p>
          <div className="absolute bottom-0 right-0 w-16 h-16 bg-teal-500/5 rounded-tl-full"></div>
        </div>
      </div>
    </div>
  );
};

export default SidebarContent;
