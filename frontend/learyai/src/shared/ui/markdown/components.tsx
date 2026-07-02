// markdown/components 负责封装 Markdown 增强渲染使用的内部 UI 组件。
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { FullscreenPreviewState } from './lib';
import { buildTableCopyText } from './lib';

interface MarkdownActionButtonProps {
  icon: string;
  label: string;
  onClick: React.MouseEventHandler<HTMLButtonElement>;
  active?: boolean;
}

interface MarkdownCopyableProps {
  onCopy: (content: string, successMessage: string) => Promise<boolean>;
}

interface MarkdownCodeBlockProps extends MarkdownCopyableProps {
  code: string;
  language: string;
  onPreview: (payload: FullscreenPreviewState) => void;
}

interface MarkdownTableBlockProps extends MarkdownCopyableProps {
  children: React.ReactNode;
  onPreview: (payload: FullscreenPreviewState) => void;
}

interface MarkdownFullscreenPreviewProps extends MarkdownCopyableProps {
  preview: FullscreenPreviewState;
  onClose: () => void;
}

const useCopiedState = () => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return { copied, setCopied };
};

export const MarkdownActionButton: React.FC<MarkdownActionButtonProps> = ({
  icon,
  label,
  onClick,
  active = false,
}) => (
  <button
    type="button"
    className={`markdown-renderer__action-button${active ? ' is-active' : ''}`}
    onClick={onClick}
  >
    <span className="markdown-renderer__action-button-icon" aria-hidden="true">
      {icon}
    </span>
    <span>{label}</span>
  </button>
);

export const MarkdownCodeBlock: React.FC<MarkdownCodeBlockProps> = ({
  code,
  language,
  onCopy,
  onPreview,
}) => {
  const { copied, setCopied } = useCopiedState();

  const handleCopy = async () => {
    const copied = await onCopy(code, `${language} 代码已复制`);
    if (copied) {
      setCopied(true);
    }
  };

  return (
    <div className="markdown-renderer__code-block">
      <div className="markdown-renderer__panel-toolbar">
        <div className="markdown-renderer__panel-title">
          <span className="markdown-renderer__panel-dot" />
          <span>{language}</span>
        </div>
        <div className="markdown-renderer__panel-actions">
          <MarkdownActionButton
            icon="◎"
            label={copied ? '已复制' : '复制'}
            onClick={handleCopy}
            active={copied}
          />
          <MarkdownActionButton
            icon="⛶"
            label="全屏查看"
            onClick={() =>
              onPreview({
                kind: 'code',
                title: `${language} 代码块`,
                language,
                content: code,
              })
            }
          />
        </div>
      </div>
      <pre className="markdown-renderer__code-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
};

export const MarkdownTableBlock: React.FC<MarkdownTableBlockProps> = ({
  children,
  onCopy,
  onPreview,
}) => {
  const { copied, setCopied } = useCopiedState();

  const handleCopy = async (event: React.MouseEvent<HTMLButtonElement>) => {
    const table = event.currentTarget.closest('.markdown-renderer__table-card')?.querySelector('table');
    if (!(table instanceof HTMLTableElement)) {
      throw new Error('表格内容不存在，无法复制。');
    }
    const copied = await onCopy(buildTableCopyText(table), '表格内容已复制');
    if (copied) {
      setCopied(true);
    }
  };

  const handlePreview = (event: React.MouseEvent<HTMLButtonElement>) => {
    const table = event.currentTarget.closest('.markdown-renderer__table-card')?.querySelector('table');
    if (!(table instanceof HTMLTableElement)) {
      throw new Error('表格内容不存在，无法全屏查看。');
    }
    onPreview({
      kind: 'table',
      title: 'Markdown 表格',
      content: children,
      copyText: buildTableCopyText(table),
    });
  };

  return (
    <div className="markdown-renderer__table-card">
      <div className="markdown-renderer__panel-toolbar">
        <div className="markdown-renderer__panel-title">
          <span className="markdown-renderer__panel-dot" />
          <span>表格</span>
        </div>
        <div className="markdown-renderer__panel-actions">
          <MarkdownActionButton
            icon="◎"
            label={copied ? '已复制' : '复制'}
            onClick={handleCopy}
            active={copied}
          />
          <MarkdownActionButton icon="⛶" label="全屏查看" onClick={handlePreview} />
        </div>
      </div>
      <div className="markdown-renderer__table-scroll">
        <table>{children}</table>
      </div>
    </div>
  );
};

export const MarkdownFullscreenPreview: React.FC<MarkdownFullscreenPreviewProps> = ({
  preview,
  onClose,
  onCopy,
}) => {
  const { copied, setCopied } = useCopiedState();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleCopy = async () => {
    const copied = await onCopy(
      preview.kind === 'code' ? preview.content : preview.copyText,
      `${preview.title}已复制`
    );
    if (copied) {
      setCopied(true);
    }
  };

  return createPortal(
    <div className="markdown-renderer__fullscreen" role="dialog" aria-modal="true" aria-label={preview.title}>
      <div className="markdown-renderer__fullscreen-backdrop" onClick={onClose} role="presentation" />
      <div className="markdown-renderer__fullscreen-panel">
        <div className="markdown-renderer__fullscreen-toolbar">
          <div className="markdown-renderer__fullscreen-heading">
            <span className="markdown-renderer__panel-dot" />
            <div>
              <div className="markdown-renderer__fullscreen-title">{preview.title}</div>
              <div className="markdown-renderer__fullscreen-subtitle">
                {preview.kind === 'code' ? '适合长代码阅读与复制' : '支持横向展开查看复杂表格'}
              </div>
            </div>
          </div>
          <div className="markdown-renderer__panel-actions">
            <MarkdownActionButton
              icon="◎"
              label={copied ? '已复制' : '复制'}
              onClick={handleCopy}
              active={copied}
            />
            <MarkdownActionButton icon="×" label="关闭" onClick={onClose} />
          </div>
        </div>
        <div className="markdown-renderer__fullscreen-body">
          {preview.kind === 'code' ? (
            <div className="markdown-renderer__fullscreen-code">
              <pre className="markdown-renderer__code-pre">
                <code>{preview.content}</code>
              </pre>
            </div>
          ) : (
            <div className="markdown-renderer__fullscreen-table">
              <div className="markdown-renderer__table-scroll">
                <table>{preview.content}</table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
