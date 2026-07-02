// KnowledgeBaseTool 负责知识库相关工具的标题与摘要渲染。
import React, { useMemo } from 'react';
import type { ContentBlock } from '../../../../entities';
import { useAppSelector } from '@/app/store/hooks';

type ToolCallContentBlock = Extract<ContentBlock, { type: 'tool_call' }>;

const extractToolName = (title: string) => title.split(':')[0]?.trim() ?? '';

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

// python-backend ws 协议字段沿用 snake_case，这里读取 doc_ids 后转成字符串。
const resolveDocIds = (raw: unknown) => {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => String(item ?? '').trim())
      .filter(Boolean);
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map((item) => String(item ?? '').trim())
            .filter(Boolean);
        }
      } catch {
        return [];
      }
    }
    return trimmed ? [trimmed] : [];
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) return [String(raw)];
  return [];
};

const resolvePageNums = (raw: unknown) => {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => Number(item)).filter((item) => Number.isFinite(item));
};

const KnowledgeBaseToolSummary: React.FC<{ call: ToolCallContentBlock }> = ({ call }) => {
  const docNameMap = useAppSelector((state) => state.resourceCenter.docNameMap);
  const toolName = extractToolName(call.title);
  const isFetch = toolName === 'KnowledgeBaseFetch';
  const isSearch = toolName === 'KnowledgeBaseSearch';
  const payloadText = extractArgsPayload(call);
  const payload = useMemo(() => safeJsonParse(payloadText) ?? {}, [payloadText]);
  const label = call.status === 'in_progress' ? '搜索' : '已搜索';
  const inProgressSuffix = call.status === 'in_progress' ? '中' : '';

  if (!isFetch && !isSearch) return null;

  if (isSearch) {
    const query = typeof payload.query === 'string' ? payload.query.trim() : '';
    const target = query ? ` ${query}` : '';
    return (
      <div className="mt-1 text-[12px] text-slate-500 dark:text-[#a0a0a0]">
        {`${label}${target}${inProgressSuffix}`}
      </div>
    );
  }

  const docIds = resolveDocIds(payload.doc_ids);
  const names = docIds
    .map((docId) => docNameMap[docId])
    .filter(Boolean) as string[];
  const target = names.length > 0 ? ` ${names.join('、')}` : ' 文件';
  const pageNums = resolvePageNums(payload.page_nums);
  const pages = pageNums.length > 0 ? ` 第${pageNums.join('、')}页` : '';

  return (
    <div className="mt-1 text-[12px] text-slate-500 dark:text-[#a0a0a0]">
      {`${label}${target}${pages}${inProgressSuffix}`}
    </div>
  );
};

const KnowledgeBaseToolTitle: React.FC<{ call: ToolCallContentBlock }> = ({ call }) => (
  <div className="space-y-1">
    <div className="font-bold text-slate-900 dark:text-white">知识库检索</div>
    <KnowledgeBaseToolSummary call={call} />
  </div>
);

export default KnowledgeBaseToolTitle;
