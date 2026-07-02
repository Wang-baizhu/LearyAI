// markdown/MarkdownRenderer 负责基于 Streamdown 装配统一的静态/流式 Markdown 渲染管线。
import React, { useCallback, useMemo, useState } from 'react';
import { Streamdown, defaultRemarkPlugins, type Components } from 'streamdown';
import { createMathPlugin } from '@streamdown/math';
import type { PluggableList } from 'unified';
import type { FullscreenPreviewState } from './lib';
import {
  extractCodeBlockMeta,
  normalizeStreamedMarkdownTables,
  remarkTeXMathCompat,
  remarkTrimMath,
  renderNodeWithLineBreaks,
  resolveLanguageLabel,
} from './lib';
import {
  MarkdownCodeBlock,
  MarkdownFullscreenPreview,
  MarkdownTableBlock,
} from './components';
import 'katex/dist/katex.min.css';
import 'streamdown/styles.css';
import './styles.css';

export interface MarkdownRendererProps {
  text: string;
  className?: string;
  isDone?: boolean;
  remarkPlugins?: PluggableList;
  components?: Components;
  allowedTags?: Record<string, string[]>;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  text,
  className,
  isDone = true,
  remarkPlugins,
  components,
  allowedTags,
}) => {
  const [preview, setPreview] = useState<FullscreenPreviewState | null>(null);
  const sourceText = typeof text === 'string' ? text : String(text ?? '');
  const safeText = useMemo(() => normalizeStreamedMarkdownTables(sourceText), [sourceText]);

  const handleCopy = useCallback(async (content: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(content);
      return true;
    } catch (error) {
      console.error(successMessage, error);
      return false;
    }
  }, []);

  const internalComponents = useMemo<Components>(
    () => ({
      pre: ({ children }) => {
        const meta = extractCodeBlockMeta(children);
        if (!meta) {
          return <pre>{children}</pre>;
        }
        return (
          <MarkdownCodeBlock
            code={meta.content}
            language={resolveLanguageLabel(meta.className)}
            onCopy={handleCopy}
            onPreview={setPreview}
          />
        );
      },
      table: ({ children }) => (
        <MarkdownTableBlock onCopy={handleCopy} onPreview={setPreview}>
          {children}
        </MarkdownTableBlock>
      ),
      th: ({ children, ...props }) => <th {...props}>{renderNodeWithLineBreaks(children)}</th>,
      td: ({ children, ...props }) => <td {...props}>{renderNodeWithLineBreaks(children)}</td>,
    }),
    [handleCopy]
  );
  const mergedAllowedTags = useMemo<Record<string, string[]>>(
    () => ({
      ...(allowedTags ?? {}),
    }),
    [allowedTags]
  );
  const mergedComponents = useMemo(
    () => ({ ...internalComponents, ...(components ?? {}) }),
    [components, internalComponents]
  );
  const activeRemarkPlugins = useMemo(
    (): PluggableList => {
      const staticPlugins: PluggableList = isDone
        ? [[remarkTeXMathCompat, safeText], remarkTrimMath]
        : [];
      return [
        ...Object.values(defaultRemarkPlugins),
        ...staticPlugins,
        ...(remarkPlugins ?? []),
      ];
    },
    [isDone, remarkPlugins, safeText]
  );
  const activePlugins = useMemo(
    () => (isDone ? { math: createMathPlugin({ singleDollarTextMath: true }) } : undefined),
    [isDone]
  );

  if (!safeText.trim()) return null;

  return (
    <div className={preview ? 'markdown-renderer__with-preview' : undefined}>
      <Streamdown
        mode={isDone ? 'static' : 'streaming'}
        className={['markdown-renderer', className].filter(Boolean).join(' ')}
        parseIncompleteMarkdown={!isDone}
        remarkPlugins={activeRemarkPlugins}
        plugins={activePlugins}
        components={mergedComponents}
        allowedTags={Object.keys(mergedAllowedTags).length > 0 ? mergedAllowedTags : undefined}
      >
        {safeText}
      </Streamdown>
      {preview ? (
        <MarkdownFullscreenPreview
          preview={preview}
          onClose={() => setPreview(null)}
          onCopy={handleCopy}
        />
      ) : null}
    </div>
  );
};

export default MarkdownRenderer;
