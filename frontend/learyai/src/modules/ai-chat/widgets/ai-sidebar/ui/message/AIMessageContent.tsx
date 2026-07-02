// AIMessageContent 负责渲染 AI 消息的 Markdown 与引用标签。
import React from 'react';
import CitationMarkdown from '@/shared/ui/CitationMarkdown';
import { useAppDispatch } from '@/app/store/hooks';
import { requestCitationJump, useScopedDocNameMap } from '@/modules/resource';

interface AIMessageContentProps {
  text: string;
  isDone?: boolean;
}

const AIMessageContent: React.FC<AIMessageContentProps> = ({ text, isDone = true }) => {
  const dispatch = useAppDispatch();
  const docNameMap = useScopedDocNameMap();
  const safeText = typeof text === 'string' ? text : String(text ?? '');

  if (!safeText.trim()) return null;
  return (
    <CitationMarkdown
      text={safeText}
      isDone={isDone}
      docNameMap={docNameMap}
      onCitationClick={({ type, pageValue }) => {
        dispatch(requestCitationJump({ source: type, pageText: pageValue }));
      }}
    />
  );
};

export default AIMessageContent;
