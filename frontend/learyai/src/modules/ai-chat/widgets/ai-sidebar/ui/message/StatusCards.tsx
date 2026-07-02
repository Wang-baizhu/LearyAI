// StatusCards 提供权限请求提示组件，供 Sidebar 消息区复用。
import React from 'react';
import type { HookRequest, PermissionRequest, QuestionRequest, ToolRequest } from '../../../../entities';
import { ShieldIcon } from './Icons';

export const PermissionRequestPanel: React.FC<{
  request?: PermissionRequest;
  onDecision?: (decision: 'approve' | 'reject' | 'approve_for_session') => void;
}> = ({ request, onDecision }) => {
  if (!request) return null;

  return (
    <div className="bg-white/90 dark:bg-[#1a1a1a] border border-emerald-100/80 dark:border-[#2a2a2a] rounded-2xl p-5 shadow-sm">
      <div className="flex items-start gap-3 mb-3">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <ShieldIcon className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-[15px] font-semibold text-emerald-800">{request.title}</h3>
          <p className="text-sm text-slate-600 dark:text-[#e0e0e0] mt-2 leading-relaxed">
            {request.description}
          </p>
        </div>
      </div>
      <div className="flex gap-3">
        {request.options.map((option) => (
          <button
            key={option}
            onClick={() =>
              onDecision?.((option as 'approve' | 'reject' | 'approve_for_session'))
            }
            className={`flex-1 py-2.5 font-semibold text-sm rounded-xl transition-colors ${
              option === 'approve'
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-white dark:bg-[#121212] border border-emerald-200/80 dark:border-[#2a2a2a] text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50/70 dark:hover:bg-emerald-900/20'
            }`}
          >
            {option === 'approve'
              ? '确认授权'
              : option === 'approve_for_session'
              ? '本会话允许'
              : '拒绝'}
          </button>
        ))}
      </div>
    </div>
  );
};

const cardClassName =
  'bg-white/90 dark:bg-[#1a1a1a] border border-slate-200/80 dark:border-[#2a2a2a] rounded-2xl p-5 shadow-sm';

export const QuestionRequestPanel: React.FC<{
  request: QuestionRequest;
  onSubmit?: (answers: Record<string, string>) => void;
}> = ({ request, onSubmit }) => {
  const [answers, setAnswers] = React.useState<Record<string, string>>({});

  return (
    <div className={cardClassName}>
      <div className="text-[15px] font-semibold text-slate-900 dark:text-white">需要你的选择</div>
      <div className="mt-3 space-y-4">
        {request.questions.map((item, index) => {
          const answerKey = item.question;
          const selected = answers[answerKey] ?? '';
          const selectedValues = item.multiSelect
            ? selected.split(', ').filter(Boolean)
            : selected
            ? [selected]
            : [];
          return (
            <div key={`${request.requestId}-${index}`} className="space-y-2">
              <div className="text-[13px] font-medium text-slate-700 dark:text-[#e0e0e0]">
                {item.question}
              </div>
              {item.body ? (
                <div className="text-[12px] text-slate-500 dark:text-[#a0a0a0]">{item.body}</div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {item.options.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() =>
                      setAnswers((current) => ({
                        ...current,
                        [answerKey]:
                          item.multiSelect && current[answerKey]
                            ? Array.from(
                                new Set(
                                  current[answerKey]
                                    .split(', ')
                                    .filter(Boolean)
                                    .concat(option.label)
                                )
                              ).join(', ')
                            : option.label,
                      }))
                    }
                    className={`rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
                      selectedValues.includes(option.label)
                        ? 'border-primary bg-primary text-white'
                        : 'border-slate-200/80 dark:border-[#2a2a2a] text-slate-600 dark:text-[#e0e0e0]'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {item.otherLabel ? (
                <input
                  value={selected && !item.options.some((option) => selectedValues.includes(option.label)) ? selected : ''}
                  onChange={(event) =>
                    setAnswers((current) => ({
                      ...current,
                      [answerKey]: event.target.value,
                    }))
                  }
                  placeholder={item.otherLabel}
                  className="w-full rounded-xl border border-slate-200/80 dark:border-[#2a2a2a] bg-transparent px-3 py-2 text-[12px]"
                />
              ) : null}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onSubmit?.(answers)}
        className="mt-4 rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-white"
      >
        提交答案
      </button>
    </div>
  );
};

export const HookRequestPanel: React.FC<{
  request: HookRequest;
  onSubmit?: (payload: { action: 'allow' | 'block'; reason?: string }) => void;
}> = ({ request, onSubmit }) => {
  const [reason, setReason] = React.useState('');

  return (
    <div className={cardClassName}>
      <div className="text-[15px] font-semibold text-slate-900 dark:text-white">Hook 需要决策</div>
      <div className="mt-2 text-[13px] text-slate-700 dark:text-[#e0e0e0]">{request.hookEvent}</div>
      {request.target ? (
        <div className="mt-1 text-[12px] text-slate-500 dark:text-[#a0a0a0]">{request.target}</div>
      ) : null}
      <textarea
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="可选：补充原因"
        className="mt-4 min-h-24 w-full rounded-xl border border-slate-200/80 dark:border-[#2a2a2a] bg-transparent px-3 py-2 text-[12px]"
      />
      <div className="mt-3 flex gap-3">
        <button
          type="button"
          onClick={() => onSubmit?.({ action: 'allow', reason })}
          className="flex-1 rounded-xl bg-emerald-600 px-4 py-2 text-[13px] font-semibold text-white"
        >
          允许
        </button>
        <button
          type="button"
          onClick={() => onSubmit?.({ action: 'block', reason })}
          className="flex-1 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-[13px] font-semibold text-rose-700"
        >
          阻止
        </button>
      </div>
    </div>
  );
};

export const ToolRequestPanel: React.FC<{
  request: ToolRequest;
  onSubmit?: (payload: { output: string; isError?: boolean; message?: string }) => void;
}> = ({ request, onSubmit }) => {
  const [output, setOutput] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [isError, setIsError] = React.useState(false);

  return (
    <div className={cardClassName}>
      <div className="text-[15px] font-semibold text-slate-900 dark:text-white">外部工具调用请求</div>
      <div className="mt-2 text-[13px] font-medium text-slate-700 dark:text-[#e0e0e0]">{request.name}</div>
      {request.arguments ? (
        <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950/90 p-3 text-[12px] text-slate-100">{request.arguments}</pre>
      ) : null}
      <textarea
        value={output}
        onChange={(event) => setOutput(event.target.value)}
        placeholder="填写返回结果"
        className="mt-4 min-h-24 w-full rounded-xl border border-slate-200/80 dark:border-[#2a2a2a] bg-transparent px-3 py-2 text-[12px]"
      />
      <input
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="可选：结果说明"
        className="mt-3 w-full rounded-xl border border-slate-200/80 dark:border-[#2a2a2a] bg-transparent px-3 py-2 text-[12px]"
      />
      <label className="mt-3 flex items-center gap-2 text-[12px] text-slate-600 dark:text-[#e0e0e0]">
        <input type="checkbox" checked={isError} onChange={(event) => setIsError(event.target.checked)} />
        作为错误结果返回
      </label>
      <button
        type="button"
        onClick={() => onSubmit?.({ output, isError, message })}
        className="mt-4 rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-white"
      >
        提交结果
      </button>
    </div>
  );
};
