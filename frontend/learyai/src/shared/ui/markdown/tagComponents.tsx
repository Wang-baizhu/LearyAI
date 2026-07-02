// markdown/tagComponents 负责复用 citation 与 timestamp 的 Markdown 自定义渲染组件装配。
import React from 'react';
import CitationTag from '../CitationTag';
import { normalizeCitationPageValue } from '@/shared/lib/citation';

type CitationProps = React.HTMLAttributes<HTMLElement> & {
  node?: unknown;
  'data-citation-label'?: string;
  'data-citation-type'?: string;
  'data-citation-page'?: string;
  'data-citation-pages'?: string;
  dataCitationLabel?: string;
  dataCitationType?: string;
  dataCitationPage?: string;
  dataCitationPages?: string;
  citationLabel?: string;
  citationType?: string;
  citationPage?: string;
  citationPages?: string;
};

type TimestampProps = React.HTMLAttributes<HTMLElement> & {
  node?: unknown;
  'data-start-seconds'?: string;
  dataStartSeconds?: string;
  startSeconds?: string;
};

export const createCitationMarkdownComponent = ({
  docNameMap,
  onCitationClick,
}: {
  docNameMap?: Record<string, string>;
  onCitationClick?: (payload: { label: string; type: string; page: string; pageValue: string }) => void;
}) => {
  const CitationMarkdownComponent = ({ ...props }: CitationProps) => {
    const label = props.citationLabel || props['data-citation-label'] || props.dataCitationLabel || '';
    const type = props.citationType || props['data-citation-type'] || props.dataCitationType || '';
    const page = props.citationPage || props['data-citation-page'] || props.dataCitationPage || '';
    const pages = String(
      props.citationPages || props['data-citation-pages'] || props.dataCitationPages || page
    )
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item);

    return (
      <CitationTag
        label={label}
        type={type}
        page={page}
        pages={pages}
        docName={docNameMap?.[type]}
        onPageClick={(selectedPage) =>
          onCitationClick?.({
            label,
            type,
            page: selectedPage,
            pageValue: normalizeCitationPageValue(selectedPage),
          })
        }
      />
    );
  };

  CitationMarkdownComponent.displayName = 'CitationMarkdownComponent';
  return CitationMarkdownComponent;
};

export const createTimestampMarkdownComponent = ({
  activeSeconds,
  onTimestampClick,
}: {
  activeSeconds?: number | null;
  onTimestampClick?: (seconds: number) => void;
}) => {
  const TimestampMarkdownComponent = ({ children, ...props }: TimestampProps) => {
    const startSeconds = Number(props.startSeconds ?? props['data-start-seconds'] ?? props.dataStartSeconds ?? '-1');
    const isActive = startSeconds >= 0 && activeSeconds === startSeconds;

    return (
      <button
        type="button"
        className={[
          'rounded-md px-1.5 py-0.5 font-semibold transition-colors',
          isActive
            ? 'bg-primary text-white'
            : 'bg-slate-100 text-primary hover:bg-slate-200 dark:bg-[#222] dark:text-sky-300 dark:hover:bg-[#2b2b2b]',
        ].join(' ')}
        onClick={() => {
          if (startSeconds >= 0) {
            onTimestampClick?.(startSeconds);
          }
        }}
      >
        {children}
      </button>
    );
  };

  TimestampMarkdownComponent.displayName = 'TimestampMarkdownComponent';
  return TimestampMarkdownComponent;
};
