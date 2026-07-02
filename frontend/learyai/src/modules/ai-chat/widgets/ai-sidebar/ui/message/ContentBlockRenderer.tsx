// ContentBlockRenderer 负责渲染已归一后的非文本 render block，避免 UI 继续解释底层协议块。
import React from 'react';
import type { HookRequest, PermissionRequest, QuestionRequest, ToolCallStatus, ToolRequest } from '../../../../entities';
import AIMessageContent from './AIMessageContent';
import { ToolCallCard } from '../tools';
import { HookRequestPanel, PermissionRequestPanel, QuestionRequestPanel, ToolRequestPanel } from './StatusCards';

interface ContentBlockRendererProps {
  block:
    | { kind: 'thinking'; text?: string }
    | { kind: 'plan'; content: string; filePath: string }
    | {
        kind: 'notification';
        notification: {
          title: string;
          body: string;
          severity: 'info' | 'warning' | 'error';
          category?: string;
        };
      }
    | {
        kind: 'status';
        status: {
          title: string;
          description?: string;
          tone?: 'info' | 'success' | 'warning' | 'error';
        };
      }
    | { kind: 'permission_request'; request: PermissionRequest }
    | { kind: 'question_request'; request: QuestionRequest }
    | { kind: 'hook_request'; request: HookRequest }
    | { kind: 'tool_request'; request: ToolRequest }
    | {
        kind: 'tool_call';
        call: {
          toolCallId: string;
          title: string;
          status: ToolCallStatus;
          args?: string;
          result?: string;
        };
      }
    | { kind: 'user_question'; text: string };
  isStreaming?: boolean;
  onPermissionDecision?: (payload: {
    toolCallId: string;
    requestId?: string;
    subagentId?: string;
    decision: 'approve' | 'reject' | 'approve_for_session';
  }) => void;
  onQuestionSubmit?: (payload: {
    requestId: string;
    subagentId?: string;
    answers: Record<string, string>;
  }) => void;
  onHookSubmit?: (payload: {
    requestId: string;
    subagentId?: string;
    action: 'allow' | 'block';
    reason?: string;
  }) => void;
  onToolSubmit?: (payload: {
    toolCallId: string;
    subagentId?: string;
    output: string;
    isError?: boolean;
    message?: string;
  }) => void;
}

const ThinkingBlock: React.FC<{ text?: string }> = ({ text }) => (
  <div className="inline-flex items-center gap-2 rounded-full bg-slate-50/90 dark:bg-[#121212] border border-slate-200/70 dark:border-[#2a2a2a] px-3 py-2 text-[11px] text-slate-500 dark:text-[#a0a0a0] shadow-sm">
    <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
    <span>{text ?? 'AI 正在思考中…'}</span>
  </div>
);

const UserQuestionBlock: React.FC<{ text: string }> = ({ text }) => (
  <div className="rounded-xl border border-slate-200/80 dark:border-[#2a2a2a] bg-slate-50/80 dark:bg-[#121212] px-3 py-1 text-[12px] text-slate-600 dark:text-[#e0e0e0] shadow-sm break-all flex items-center">
    <AIMessageContent text={text} />
  </div>
);

const PlanBlock: React.FC<{ content: string; filePath: string }> = ({ content, filePath }) => (
  <div className="rounded-2xl border border-sky-100/80 dark:border-[#2a2a2a] bg-sky-50/60 dark:bg-[#121212] p-4 shadow-sm space-y-3">
    <div>
      <div className="text-[12px] font-semibold text-sky-700 dark:text-sky-300">执行计划</div>
      <div className="mt-1 text-[11px] text-slate-500 dark:text-[#a0a0a0] break-all">
        {filePath}
      </div>
    </div>
    <div className="rounded-xl bg-white/80 dark:bg-[#0f0f0f] border border-sky-100/80 dark:border-[#2a2a2a] p-3 text-[12px] text-slate-700 dark:text-[#e0e0e0] whitespace-pre-wrap">
      {content}
    </div>
  </div>
);

const statusToneClassName: Record<'info' | 'success' | 'warning' | 'error', string> = {
  info: 'border-slate-200/80 bg-slate-50/80 text-slate-700 dark:border-[#2a2a2a] dark:bg-[#121212] dark:text-[#e0e0e0]',
  success:
    'border-emerald-100/80 bg-emerald-50/60 text-emerald-800 dark:border-[#2a2a2a] dark:bg-[#101010] dark:text-emerald-300',
  warning:
    'border-amber-100/80 bg-amber-50/70 text-amber-800 dark:border-[#2a2a2a] dark:bg-[#15120a] dark:text-amber-300',
  error:
    'border-rose-100/80 bg-rose-50/70 text-rose-800 dark:border-[#2a2a2a] dark:bg-[#181010] dark:text-rose-300',
};

const StatusBlock: React.FC<{
  title: string;
  description?: string;
  tone?: 'info' | 'success' | 'warning' | 'error';
}> = ({ title, description, tone = 'info' }) => (
  <div className={`rounded-2xl border p-3 shadow-sm ${statusToneClassName[tone]}`}>
    <div className="text-[12px] font-semibold">{title}</div>
    {description ? <div className="mt-1 text-[12px] whitespace-pre-wrap">{description}</div> : null}
  </div>
);

const renderToolCall = (
  block: Extract<ContentBlockRendererProps['block'], { kind: 'tool_call' }>,
  isStreaming?: boolean
) => (
  <ToolCallCard
    call={{
      type: 'tool_call',
      toolCallId: block.call.toolCallId,
      title: block.call.title,
      status: block.call.status,
      args: block.call.args,
      result: block.call.result,
    }}
    isStreaming={isStreaming}
  />
);

const ContentBlockRenderer: React.FC<ContentBlockRendererProps> = ({
  block,
  isStreaming,
  onPermissionDecision,
  onQuestionSubmit,
  onHookSubmit,
  onToolSubmit,
}) => {
  if (block.kind === 'thinking') {
    return <ThinkingBlock text={block.text} />;
  }

  if (block.kind === 'plan') {
    return <PlanBlock content={block.content} filePath={block.filePath} />;
  }

  if (block.kind === 'notification') {
    return (
      <StatusBlock
        title={block.notification.title}
        description={block.notification.body}
        tone={block.notification.severity === 'error' ? 'error' : block.notification.severity}
      />
    );
  }

  if (block.kind === 'status') {
    return (
      <StatusBlock
        title={block.status.title}
        description={block.status.description}
        tone={block.status.tone}
      />
    );
  }

  if (block.kind === 'permission_request') {
    return (
      <PermissionRequestPanel
        request={block.request}
        onDecision={(decision) =>
          onPermissionDecision?.({
            toolCallId: block.request.toolCallId,
            requestId: block.request.requestId,
            subagentId: block.request.subagentId,
            decision,
          })
        }
      />
    );
  }

  if (block.kind === 'question_request') {
    return (
      <QuestionRequestPanel
        request={block.request}
        onSubmit={(answers) =>
          onQuestionSubmit?.({
            requestId: block.request.requestId,
            subagentId: block.request.subagentId,
            answers,
          })
        }
      />
    );
  }

  if (block.kind === 'hook_request') {
    return (
      <HookRequestPanel
        request={block.request}
        onSubmit={(payload) =>
          onHookSubmit?.({
            requestId: block.request.requestId,
            subagentId: block.request.subagentId,
            ...payload,
          })
        }
      />
    );
  }

  if (block.kind === 'tool_request') {
    return (
      <ToolRequestPanel
        request={block.request}
        onSubmit={(payload) =>
          onToolSubmit?.({
            toolCallId: block.request.toolCallId,
            subagentId: block.request.subagentId,
            ...payload,
          })
        }
      />
    );
  }

  if (block.kind === 'tool_call') {
    return renderToolCall(block, isStreaming);
  }

  return <UserQuestionBlock text={block.text} />;
};

export default ContentBlockRenderer;
