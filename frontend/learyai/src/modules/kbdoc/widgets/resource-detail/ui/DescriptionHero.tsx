// DescriptionHero 负责展示资源详情中的文档概要区块与描述就地编辑入口。
import React from 'react';
import { EditableText } from '@leary/text-editable';
import { useAppSelector } from '@/app/store/hooks';
import CitationMarkdown from '@/shared/ui/CitationMarkdown';
import type { ResourceTextEditAnchor } from '../lib/resourceTextEdit';
import { MARKDOWN_CONTENT_CLASS_NAME } from './constants';

interface DescriptionHeroProps {
  docId: string;
  content: string;
  onRequestTextEdit: (payload: {
    title: string;
    value: string;
    anchor: ResourceTextEditAnchor;
    multiline?: boolean;
  }) => void;
}

const DescriptionHero: React.FC<DescriptionHeroProps> = ({ docId, content, onRequestTextEdit }) => {
  const docNameMap = useAppSelector((state) => state.resourceCenter.docNameMap);

  return (
    <section className="relative mb-8 overflow-hidden rounded-[2rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] px-7 py-7 shadow-[0_16px_40px_rgba(15,23,42,0.06)] dark:border-[#2a2a2a] dark:bg-[linear-gradient(180deg,rgba(23,23,23,0.98),rgba(18,18,18,0.98))]">
      <div className="pointer-events-none absolute inset-y-6 left-0 w-1 rounded-full bg-primary/80" />
      <div className="mb-4 flex items-center gap-3">
        <span className="inline-flex rounded-full border border-primary/15 bg-primary/8 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-primary shadow-sm dark:border-primary/20 dark:bg-primary/12 dark:text-white">
          Document Brief
        </span>
        <div className="h-px flex-1 bg-gradient-to-r from-primary/20 via-slate-200 to-transparent dark:from-primary/35 dark:via-white/10 dark:to-transparent" />
      </div>
      <div className="mb-3 pl-4 text-sm font-semibold tracking-[0.18em] text-slate-500 dark:text-slate-400">
        文档概要
      </div>
      <EditableText
        title="描述"
        value={content}
        anchor={{ kind: 'description' }}
        triggerClassName="right-0 top-0"
        onRequestEdit={onRequestTextEdit}
      >
        {content ? (
          <CitationMarkdown
            text={content}
            pageMarkerDocId={docId}
            docNameMap={docNameMap}
            className={`pl-4 ${MARKDOWN_CONTENT_CLASS_NAME}`}
          />
        ) : (
          <div className="pl-4 text-sm text-slate-400 dark:text-slate-500">
            添加文档概要
          </div>
        )}
      </EditableText>
    </section>
  );
};

export default DescriptionHero;
