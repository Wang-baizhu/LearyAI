// CitationTag 负责渲染引用标签并支持点击跳转到引用页。
import React from 'react';
import { normalizeCitationPageValue } from '@/shared/lib/citation';

interface CitationTagProps {
  label: string;
  type: string;
  page: string;
  pages?: string[];
  docName?: string;
  onPageClick?: (page: string) => void;
}

const CitationTag: React.FC<CitationTagProps> = ({ page, pages, docName, onPageClick }) => {
  const [expanded, setExpanded] = React.useState(false);
  const resolvedDocName = String(docName ?? '').trim() || '文档';
  const resolvedPages = (pages && pages.length > 0 ? pages : [page]).map((item) => normalizeCitationPageValue(item));
  const previewText = resolvedDocName.slice(0, 5);
  const hasOverflow = resolvedDocName.length > 5;
  const displayName = expanded || !hasOverflow ? resolvedDocName : `${previewText}...`;

  return (
    <span
      title={resolvedDocName}
      className="inline-flex max-w-full items-center gap-2 bg-gradient-to-b from-white to-slate-50 dark:from-[#1a1a1a] dark:to-[#121212] border border-slate-200/70 dark:border-[#2a2a2a] rounded-2xl px-3 py-2 shadow-[0_6px_18px_-10px_rgba(15,23,42,0.35)] dark:shadow-[0_6px_18px_-10px_rgba(0,0,0,0.6)] mx-1 my-1 align-middle hover:border-teal-300/80 hover:shadow-[0_10px_22px_-12px_rgba(15,23,42,0.5)] dark:hover:shadow-[0_10px_22px_-12px_rgba(0,0,0,0.8)] transition-all select-none group"
    >
      <span className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="block text-left text-[12px] font-semibold leading-5 text-slate-800 dark:text-[#e0e0e0]"
        >
          <span>{displayName}</span>
          {hasOverflow ? (
            <span className="ml-1 text-[11px] font-bold text-emerald-600 dark:text-[#26BBA4]">
              {expanded ? '收起' : '展开'}
            </span>
          ) : null}
        </button>
      </span>
      <span className="shrink-0 flex items-center gap-1.5">
        {resolvedPages.map((pageValue) => (
          <button
            key={pageValue}
            type="button"
            onClick={() => onPageClick?.(pageValue)}
            className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-[#121212] dark:to-[#1a1a1a] border border-emerald-100 dark:border-[#2a2a2a] rounded-[10px] px-2.5 py-1 flex items-center justify-center group-hover:from-emerald-100 group-hover:to-teal-100 dark:group-hover:from-[#1a1a1a] dark:group-hover:to-[#121212] transition-colors"
            title={`点击打开 PDF 第 ${pageValue} 页`}
          >
            <span className="text-emerald-600 dark:text-[#26BBA4] font-bold text-[11px] tracking-wide leading-none">
              P{pageValue}
            </span>
          </button>
        ))}
      </span>
    </span>
  );
};

export default CitationTag;
