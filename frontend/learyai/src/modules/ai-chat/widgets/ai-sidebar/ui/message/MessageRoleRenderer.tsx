// MessageRoleRenderer 负责按照 render message 的角色输出对应气泡样式与文本操作。
import React, { useEffect, useState } from 'react';
import type { RenderMessage, RenderTextBlock } from '../../../../entities';
import AIMessageContent from './AIMessageContent';
import UserMessageContent from './UserMessageContent';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';
import RenderBlockList from './RenderBlockList';

interface MessageRoleRendererProps {
  message: RenderMessage;
  isStreaming?: boolean;
  isLastTextAssistant?: boolean;
  onPermissionDecision?: (payload: {
    toolCallId: string;
    requestId?: string;
    decision: 'approve' | 'reject' | 'approve_for_session';
  }) => void;
  onQuestionSubmit?: (payload: { requestId: string; answers: Record<string, string> }) => void;
  onHookSubmit?: (payload: { requestId: string; action: 'allow' | 'block'; reason?: string }) => void;
  onToolSubmit?: (payload: {
    toolCallId: string;
    output: string;
    isError?: boolean;
    message?: string;
  }) => void;
  onSaveTextBlock?: (payload: { text: string }) => Promise<void> | void;
}

const MessageRoleRenderer: React.FC<MessageRoleRendererProps> = ({
  message,
  isStreaming,
  isLastTextAssistant = false,
  onPermissionDecision,
  onQuestionSubmit,
  onHookSubmit,
  onToolSubmit,
  onSaveTextBlock,
}) => {
  const isUser = message.sender === 'user';
  const isSystem = message.sender === 'system';
  const isAssistant = message.sender === 'assistant';
  const [copiedBlockKey, setCopiedBlockKey] = useState<string | null>(null);
  const [savingBlockKey, setSavingBlockKey] = useState<string | null>(null);
  const [savedBlockKey, setSavedBlockKey] = useState<string | null>(null);
  const [saveFailedBlockKey, setSaveFailedBlockKey] = useState<string | null>(null);

  useEffect(() => {
    if (!copiedBlockKey) return;
    const timer = window.setTimeout(() => {
      setCopiedBlockKey(null);
    }, 1600);
    return () => window.clearTimeout(timer);
    }, [copiedBlockKey]);

  useEffect(() => {
    if (!savedBlockKey && !saveFailedBlockKey) return;
    const timer = window.setTimeout(() => {
      setSavedBlockKey(null);
      setSaveFailedBlockKey(null);
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [savedBlockKey, saveFailedBlockKey]);

  const wrapperAlign = isUser ? 'items-end' : isSystem ? 'items-center' : 'items-start';
  const bubbleWidth = isSystem ? 'max-w-[80%]' : isUser ? 'max-w-[82%]' : 'w-full';
  const bubbleBase = 'relative px-3.5 text-[13px] leading-snug transition-shadow';
  const bubbleClasses = isSystem
    ? `${bubbleBase} py-2.5 bg-slate-50/90 dark:bg-[#121212] border border-dashed border-slate-200/80 dark:border-[#2a2a2a] text-slate-500 dark:text-[#a0a0a0] rounded-2xl text-center`
    : isUser
    ? `${bubbleBase} py-2.5 bg-primary text-white border border-primary/20 rounded-2xl rounded-tr-md shadow-lg shadow-primary/15`
    : `${bubbleBase} py-0 bg-transparent border border-transparent text-slate-700 dark:text-[#e0e0e0] rounded-2xl rounded-tl-md`;
  const handleCopy = async (copyText: string, blockKey: string) => {
    const content = isAssistant ? copyText : copyText;
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopiedBlockKey(blockKey);
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  const handleSave = async (block: RenderTextBlock) => {
    if (!onSaveTextBlock || !block.saveText.trim() || savingBlockKey === block.key) {
      return;
    }
    try {
      setSavingBlockKey(block.key);
      setSaveFailedBlockKey(null);
      await onSaveTextBlock({ text: block.saveText });
      setSavedBlockKey(block.key);
    } catch (error) {
      console.error('保存失败:', error);
      setSaveFailedBlockKey(block.key);
    } finally {
      setSavingBlockKey((current) => (current === block.key ? null : current));
    }
  };

  const renderTextActions = (block: RenderTextBlock) => {
    if (isSystem) return null;
    if (isAssistant && isLastTextAssistant && isStreaming) return null;
    const isCopied = copiedBlockKey === block.key;
    if (isUser) {
      return (
        <div className="pointer-events-none absolute top-0 right-0 z-10 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto">
          <button
            type="button"
            onClick={() => handleCopy(block.copyText, block.key)}
            className="text-white hover:text-white bg-primary/90 hover:bg-primary px-1.5 py-1 rounded-md shadow-sm transition-colors"
            aria-label={isCopied ? '已复制' : '复制'}
            title={isCopied ? '已复制' : '复制'}
          >
            <MaterialIcon
              name={isCopied ? 'check' : 'content_copy'}
              className="text-sm"
            />
          </button>
        </div>
      );
    }

    const isSaving = savingBlockKey === block.key;
    const isSaved = savedBlockKey === block.key;
    const isSaveFailed = saveFailedBlockKey === block.key;
    const saveLabel = isSaving ? '保存中...' : isSaved ? '已保存' : isSaveFailed ? '保存失败' : '保存';

    return (
      <div
        className="pointer-events-none absolute top-full left-0 mt-1 z-10 flex justify-start opacity-0 translate-y-1 transition-all duration-150 group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:translate-y-0 group-focus-within:pointer-events-auto"
      >
        <div className="inline-flex items-center gap-2 bg-transparent px-1 py-0.5">
          <button
            type="button"
            onClick={() => handleSave(block)}
            disabled={!onSaveTextBlock || isSaving}
            className="flex items-center gap-1 text-primary dark:text-teal-400 text-xs font-semibold bg-transparent hover:text-teal-600 dark:hover:text-teal-300 px-1.5 py-1 rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            <MaterialIcon
              name={isSaved ? 'check' : isSaveFailed ? 'error' : 'save'}
              className="text-sm"
            />
            {saveLabel}
          </button>
          <button
            type="button"
            onClick={() => handleCopy(block.copyText, block.key)}
            className="flex items-center gap-1 text-primary dark:text-teal-400 text-xs font-semibold bg-transparent hover:text-teal-600 dark:hover:text-teal-300 px-1.5 py-1 rounded-md transition-colors"
          >
            <MaterialIcon
              name={isCopied ? 'check' : 'content_copy'}
              className="text-sm"
            />
            {isCopied ? '已复制' : '复制'}
          </button>
        </div>
      </div>
    );
  };

  const renderTextNode = (block: RenderTextBlock) => (
    <div
      className={
        isUser
          ? 'relative group'
          : "relative group after:absolute after:left-0 after:right-0 after:top-full after:h-3 after:content-['']"
      }
    >
      {isUser ? (
        <UserMessageContent text={block.text} className="whitespace-pre-wrap break-all text-white" />
      ) : (
        <AIMessageContent
          text={block.text}
          isDone={!(isAssistant && isLastTextAssistant && isStreaming)}
        />
      )}
      {renderTextActions(block)}
    </div>
  );

  return (
    <div className={`flex flex-col gap-1 ${wrapperAlign}`}>
      <div className={`${bubbleWidth} ${bubbleClasses}`}>
        <div className={isUser ? 'space-y-1' : 'space-y-2'}>
          <RenderBlockList
            blocks={message.blocks}
            isStreaming={isStreaming}
            renderTextBlock={renderTextNode}
            onPermissionDecision={onPermissionDecision}
            onQuestionSubmit={onQuestionSubmit}
            onHookSubmit={onHookSubmit}
            onToolSubmit={onToolSubmit}
          />
        </div>
      </div>
    </div>
  );
};

export default MessageRoleRenderer;
