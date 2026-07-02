// ToolCard 负责渲染工具调用卡片与详情弹窗，并提供可替换的标题区域。
import React from 'react';
import type { ContentBlock } from '../../../../entities';
import LoadingSpinner from '@/shared/ui/LoadingSpinner';
import { Modal } from '@leary/ui';
import KnowledgeBaseToolTitle from './KnowledgeBaseTool';
import GetDocInfoToolTitle from './GetDocInfoTool';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';

type ToolCallContentBlock = Extract<ContentBlock, { type: 'tool_call' }>;
type ToolResultContentBlock = Extract<ContentBlock, { type: 'tool_result' }>;

const statusLabels: Record<string, { text: string; color: string }> = {
  succeeded: { text: '成功', color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
  completed: { text: '完成', color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
  failed: { text: '失败', color: 'bg-rose-50 text-rose-600 border-rose-100' },
  in_progress: { text: '进行中', color: 'bg-sky-50 text-sky-600 border-sky-100' },
};

const titleMap: Record<string, string> = {};

const resolveStatusLabel = (status: string) =>
  statusLabels[status] ?? { text: status, color: 'bg-slate-100 text-slate-600 border-slate-200' };

const resolveTitle = (title: string) => titleMap[title] ?? title;

const extractToolName = (title: string) => title.split(':')[0]?.trim() ?? '';

const toolTitleRenderers: Record<string, React.FC<{ call: ToolCallContentBlock }>> = {
  KnowledgeBaseFetch: KnowledgeBaseToolTitle,
  KnowledgeBaseSearch: KnowledgeBaseToolTitle,
  get_doc_info: GetDocInfoToolTitle,
};

const resolveToolCallStatus = (status: string, isStreaming?: boolean) => {
  if (status === 'in_progress' && isStreaming === false) {
    return 'failed';
  }
  return status;
};

const renderStatusIndicator = (status: string, isStreaming?: boolean) => {
  const resolvedStatus = resolveToolCallStatus(status, isStreaming);
  if (resolvedStatus === 'in_progress') {
    return (
      <LoadingSpinner
        size={16}
        label=""
        borderColor="rgba(0,0,0,0.12)"
        borderTopColor="currentColor"
      />
    );
  }
  if (resolvedStatus === 'completed' || resolvedStatus === 'succeeded') {
    return <MaterialIcon name="done" className="text-[20px] text-emerald-600" />;
  }
  const statusInfo = resolveStatusLabel(resolvedStatus);
  return (
    <span
      className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest ${statusInfo.color}`}
    >
      {statusInfo.text}
    </span>
  );
};

const ToolCallTitle: React.FC<{ call: ToolCallContentBlock }> = ({ call }) => {
  const toolName = extractToolName(call.title);
  const ToolTitle = toolTitleRenderers[toolName];
  if (ToolTitle) {
    return <ToolTitle call={call} />;
  }
  return (
    <h4 className="font-bold text-slate-900 dark:text-white">
      {resolveTitle(call.title)}
    </h4>
  );
};

export const ToolCallCard: React.FC<{ call: ToolCallContentBlock; isStreaming?: boolean }> = ({
  call,
  isStreaming,
}) => {
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);

  return (
    <>
      <div className="bg-emerald-50/70 dark:bg-[#121212] border border-emerald-100/80 dark:border-[#2a2a2a] rounded-2xl p-3 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {renderStatusIndicator(call.status, isStreaming)}
            <div>
              <ToolCallTitle call={call} />
              <div className="mt-1 text-[11px] text-slate-500 dark:text-[#a0a0a0]">
                工具调用 · {call.status === 'in_progress' ? '运行中' : '已完成'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(call.args || call.result) && (
              <button
                type="button"
                onClick={() => setIsDetailOpen(true)}
                className="text-primary hover:opacity-80 transition-opacity"
                aria-label="查看详情"
              >
                <MaterialIcon name="arrow_forward_ios" className="text-[18px]" />
              </button>
            )}
          </div>
        </div>
      </div>
      <Modal isOpen={isDetailOpen} title={resolveTitle(call.title)} onClose={() => setIsDetailOpen(false)}>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {call.args && (
            <div className="bg-slate-950/90 text-slate-100 text-[12px] font-mono rounded-xl p-3 overflow-x-auto border border-slate-800/60">
              <div className="text-[11px] text-slate-400 mb-2">调用参数</div>
              <span className="text-emerald-400">{'>>>'}</span>
              <span className="ml-2">{call.args}</span>
            </div>
          )}
          {call.result && (
            <div className="text-sm text-slate-600 dark:text-[#e0e0e0] bg-slate-50/70 dark:bg-[#121212] border border-slate-200/60 dark:border-[#2a2a2a] rounded-xl p-3">
              <div className="text-[11px] text-slate-400 mb-2">输出结果</div>
              <span>{call.result}</span>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};

export const ToolCallGroup: React.FC<{
  call: ToolCallContentBlock;
  result: ToolResultContentBlock;
  isStreaming?: boolean;
}> = ({ call, result, isStreaming }) => {
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);

  return (
    <>
      <div className="bg-emerald-50/70 dark:bg-[#121212] border border-emerald-100/80 dark:border-[#2a2a2a] rounded-2xl p-3 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {renderStatusIndicator(call.status, isStreaming)}
            <div>
              <ToolCallTitle call={call} />
              <div className="mt-1 text-[11px] text-slate-500 dark:text-[#a0a0a0]">
                工具调用 · {call.status === 'in_progress' ? '运行中' : '已完成'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsDetailOpen(true)}
              className="text-primary hover:opacity-80 transition-opacity"
              aria-label="查看详情"
            >
              <MaterialIcon name="arrow_forward_ios" className="text-[18px]" />
            </button>
          </div>
        </div>
      </div>
      <Modal isOpen={isDetailOpen} title={resolveTitle(call.title)} onClose={() => setIsDetailOpen(false)}>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {call.args && (
            <div className="bg-slate-950/90 text-slate-100 text-[12px] font-mono rounded-xl p-3 overflow-x-auto border border-slate-800/60">
              <div className="text-[11px] text-slate-400 mb-2">调用参数</div>
              <span className="text-emerald-400">{'>>>'}</span>
              <span className="ml-2">{call.args}</span>
            </div>
          )}
          <div className="text-sm text-slate-600 dark:text-[#e0e0e0] whitespace-pre-wrap bg-slate-50/70 dark:bg-[#121212] border border-slate-200/60 dark:border-[#2a2a2a] rounded-xl p-3">
            <div className="text-[11px] text-slate-400 mb-2">输出结果</div>
            <span>{result.result}</span>
          </div>
        </div>
      </Modal>
    </>
  );
};
