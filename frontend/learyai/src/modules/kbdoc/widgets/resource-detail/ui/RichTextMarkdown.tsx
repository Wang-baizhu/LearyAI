// RichTextMarkdown 负责在资源文本预览中同时渲染 citation 与 timestamp 交互。
import React from 'react';
import { useAppSelector } from '@/app/store/hooks';
import remarkBreaks from 'remark-breaks';
import MarkdownRenderer from '@/shared/ui/MarkdownRenderer';
import {
  createRemarkCitations,
  createRemarkPageMarkers,
  createRemarkTimestamps,
} from '@/shared/ui/markdown/remarkTextDecorators';
import {
  createCitationMarkdownComponent,
  createTimestampMarkdownComponent,
} from '@/shared/ui/markdown/tagComponents';

interface RichTextMarkdownProps {
  text: string;
  className?: string;
  pageMarkerDocId?: string;
  activeSeconds?: number | null;
  onTimestampClick?: (seconds: number) => void;
  onCitationClick?: (payload: { label: string; type: string; page: string; pageValue: string }) => void;
}

const RichTextMarkdown: React.FC<RichTextMarkdownProps> = ({
  text,
  className,
  pageMarkerDocId,
  activeSeconds,
  onTimestampClick,
  onCitationClick,
}) => {
  const safeText = typeof text === 'string' ? text : String(text ?? '');
  const docNameMap = useAppSelector((state) => state.resourceCenter.docNameMap);
  const remarkPageMarkers = React.useMemo(
    () => (pageMarkerDocId ? createRemarkPageMarkers(pageMarkerDocId) : null),
    [pageMarkerDocId]
  );
  const remarkCitations = React.useMemo(() => createRemarkCitations(), []);
  const remarkTimestamps = React.useMemo(() => createRemarkTimestamps(), []);
  const CitationComponent = React.useMemo(
    () =>
      createCitationMarkdownComponent({
        docNameMap,
        onCitationClick,
      }),
    [docNameMap, onCitationClick]
  );
  const TimestampComponent = React.useMemo(
    () =>
      createTimestampMarkdownComponent({
        activeSeconds,
        onTimestampClick,
      }),
    [activeSeconds, onTimestampClick]
  );

  return (
    <MarkdownRenderer
      text={safeText}
      className={className}
      remarkPlugins={[...(remarkPageMarkers ? [remarkPageMarkers] : []), remarkCitations, remarkTimestamps, remarkBreaks]}
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
        'timestamp-link': ['startSeconds', 'data-start-seconds'],
      }}
      components={
        {
          citation: CitationComponent,
          'timestamp-link': TimestampComponent,
        } as never
      }
    />
  );
};

export default RichTextMarkdown;
