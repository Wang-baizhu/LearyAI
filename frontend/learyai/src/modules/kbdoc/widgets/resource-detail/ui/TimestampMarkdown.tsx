// TimestampMarkdown 负责在 Markdown 中渲染可点击的时间戳区间。
import React from 'react';
import remarkBreaks from 'remark-breaks';
import MarkdownRenderer from '@/shared/ui/MarkdownRenderer';
import { createRemarkTimestamps } from '@/shared/ui/markdown/remarkTextDecorators';
import { createTimestampMarkdownComponent } from '@/shared/ui/markdown/tagComponents';

interface TimestampMarkdownProps {
  text: string;
  className?: string;
  activeSeconds?: number | null;
  onTimestampClick?: (seconds: number) => void;
}

const TimestampMarkdown: React.FC<TimestampMarkdownProps> = ({
  text,
  className,
  activeSeconds,
  onTimestampClick,
}) => {
  const safeText = typeof text === 'string' ? text : String(text ?? '');
  const remarkTimestamp = React.useMemo(() => createRemarkTimestamps(), []);
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
      remarkPlugins={[remarkTimestamp, remarkBreaks]}
      allowedTags={{
        'timestamp-link': ['startSeconds', 'data-start-seconds'],
      }}
      components={
        {
          'timestamp-link': TimestampComponent,
        } as never
      }
    />
  );
};

export default TimestampMarkdown;
