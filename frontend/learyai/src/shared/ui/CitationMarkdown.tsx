// CitationMarkdown 负责渲染支持引用跳转的 Markdown 内容。
import React from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import { createRemarkCitations, createRemarkPageMarkers } from './markdown/remarkTextDecorators';
import { createCitationMarkdownComponent } from './markdown/tagComponents';

interface CitationMarkdownProps {
  text: string;
  className?: string;
  isDone?: boolean;
  pageMarkerDocId?: string;
  docNameMap?: Record<string, string>;
  onCitationClick?: (payload: { label: string; type: string; page: string; pageValue: string }) => void;
}

type AnchorProps = React.ComponentPropsWithoutRef<'a'> & { node?: unknown };

const CitationMarkdown: React.FC<CitationMarkdownProps> = ({
  text,
  className,
  isDone = true,
  pageMarkerDocId,
  docNameMap,
  onCitationClick,
}) => {
  const safeText = typeof text === 'string' ? text : String(text ?? '');
  const remarkCitations = React.useMemo(() => createRemarkCitations(), []);
  const remarkPageMarkers = React.useMemo(
    () => (pageMarkerDocId ? createRemarkPageMarkers(pageMarkerDocId) : null),
    [pageMarkerDocId]
  );
  const CitationComponent = React.useMemo(
    () =>
      createCitationMarkdownComponent({
        docNameMap,
        onCitationClick,
      }),
    [docNameMap, onCitationClick]
  );

  if (!safeText.trim()) return null;

  const components = {
    citation: CitationComponent,
    a: ({ href, children, ...props }: AnchorProps) => (
      <a href={href} {...props}>
        {children}
      </a>
    ),
  };

  return (
    <MarkdownRenderer
      text={safeText}
      className={className}
      isDone={isDone}
      remarkPlugins={[...(remarkPageMarkers ? [remarkPageMarkers] : []), remarkCitations]}
      allowedTags={{
        citation: [
          'citationLabel',
          'citationType',
          'citationPage',
          'citationPages',
          'data-citation-label',
          'data-citation-type',
          'data-citation-page',
          'data-citation-pages',
        ],
      }}
      components={components}
    />
  );
};

export default CitationMarkdown;
