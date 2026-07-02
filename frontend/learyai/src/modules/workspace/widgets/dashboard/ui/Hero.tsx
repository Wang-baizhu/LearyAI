// Hero 负责展示工作区欢迎语、图标和简介信息。
import React from 'react';

const HERO_DESCRIPTION = '这是一个 AI 知识库应用，它能检索您上传的知识库，也能基于知识库生成脑图、题目等可视化内容。';

const Hero: React.FC = () => {
  return (
    <section className="mb-6 px-1 py-1 md:mb-12 md:py-2">
      <style>{`
        @keyframes workspace-hero-typing {
          from { width: 0; }
          to { width: 13ch; }
        }

        @keyframes workspace-hero-caret {
          0%, 49% { border-color: rgba(20, 184, 166, 0.95); }
          50%, 100% { border-color: transparent; }
        }

        @keyframes workspace-hero-caret-hide {
          from { border-color: transparent; }
          to { border-color: transparent; }
        }

        @keyframes workspace-hero-copy-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(calc(-50% - 0.75rem)); }
        }
      `}</style>
      <div className="min-w-0">
        <div className="mb-2 flex items-center gap-2.5 sm:gap-4 md:mb-3">
          <div aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center self-center sm:h-14 sm:w-14">
            <svg viewBox="0 -960 960 960" className="h-14 w-14 text-slate-900 dark:text-white sm:h-16 sm:w-16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="m499-287 335-335-52-52-335 335 52 52Zm-261 87q-100-5-149-42T40-349q0-65 53.5-105.5T242-503q39-3 58.5-12.5T320-542q0-26-29.5-39T193-600l7-80q103 8 151.5 41.5T400-542q0 53-38.5 83T248-423q-64 5-96 23.5T120-349q0 35 28 50.5t94 18.5l-4 80Zm280 7L353-358l382-382q20-20 47.5-20t47.5 20l70 70q20 20 20 47.5T900-575L518-193Zm-159 33q-17 4-30-9t-9-30l33-159 165 165-159 33Z" />
            </svg>
          </div>
          <h2
            aria-label="Welcome Back!"
            className="w-[13ch] overflow-hidden whitespace-nowrap border-r-2 border-cyan-500 text-3xl font-black leading-none tracking-[-0.04em] text-slate-900 dark:text-white sm:text-[3.25rem] motion-reduce:w-auto motion-reduce:animate-none motion-reduce:border-r-0"
            style={{
              animation:
                'workspace-hero-typing 2.4s steps(13,end) 1 forwards, workspace-hero-caret .9s step-end 3, workspace-hero-caret-hide 0.01s linear 2.7s 1 forwards',
            }}
          >
            Welcome Back!
          </h2>
        </div>
        <div className="max-w-2xl overflow-hidden sm:pl-[4.5rem]">
          <div
            aria-hidden="true"
            className="flex w-max max-w-none items-center gap-6 whitespace-nowrap text-sm leading-7 text-slate-500 [animation:workspace-hero-copy-scroll_12s_linear_infinite] dark:text-slate-400 sm:text-base sm:leading-8 motion-reduce:animate-none"
          >
            <p>{HERO_DESCRIPTION}</p>
            <p>{HERO_DESCRIPTION}</p>
          </div>
          <p className="sr-only">{HERO_DESCRIPTION}</p>
        </div>
      </div>
    </section>
  );
};

export default Hero;
