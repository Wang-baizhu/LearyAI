// GetDocInfoTool 负责获取知识库信息工具的标题与摘要渲染。
import React, { useMemo } from 'react';
import type { ContentBlock } from '../../../../entities';
import { useAppSelector } from '@/app/store/hooks';

type ToolCallContentBlock = Extract<ContentBlock, { type: 'tool_call' }>;

const extractArgsPayload = (call: ToolCallContentBlock) => {
  if (call.args) return call.args;
  if (call.title.includes(':')) {
    return call.title.split(':').slice(1).join(':').trim();
  }
  return '';
};

const safeJsonParse = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const resolveDocId = (raw: unknown) => {
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  return null;
};

const GetDocInfoToolSummary: React.FC<{ call: ToolCallContentBlock }> = ({ call }) => {
  const docNameMap = useAppSelector((state) => state.resourceCenter.docNameMap);
  const payloadText = extractArgsPayload(call);
  const payload = useMemo(() => safeJsonParse(payloadText) ?? {}, [payloadText]);
  const docId = resolveDocId(payload.doc_id);
  // python-backend ws 协议字段沿用 snake_case，这里按协议读取 doc_id。
  const name = docId !== null ? docNameMap[docId] ?? '' : '';
  const target = name || '文档';

  return (
    <div className="mt-1 text-[12px] text-slate-500 dark:text-[#a0a0a0]">
      {`已查看${target}基本信息`}
    </div>
  );
};

const GetDocInfoToolTitle: React.FC<{ call: ToolCallContentBlock }> = ({ call }) => (
  <div className="space-y-1">
    <div className="font-bold text-slate-900 dark:text-white">获取知识库信息</div>
    <GetDocInfoToolSummary call={call} />
  </div>
);

export default GetDocInfoToolTitle;
