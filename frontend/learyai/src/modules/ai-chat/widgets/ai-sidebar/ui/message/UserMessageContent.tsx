// UserMessageContent 负责在保留纯文本语义的同时渲染引用标签。
import React from 'react';
import CitationTag from '@/shared/ui/CitationTag';
import { normalizeCitationPageValue, splitTextByCitations, type CitationMeta } from '@/shared/lib/citation';
import { useAppDispatch } from '@/app/store/hooks';
import { requestCitationJump, useScopedDocNameMap } from '@/modules/resource';

interface UserMessageContentProps {
  text: string;
  className?: string;
}

const parseCitationNodes = (text: string): Array<string | CitationMeta> => {
  return splitTextByCitations(text).map((segment) =>
    segment.kind === 'text' ? segment.value : segment.value
  );
};

const UserMessageContent: React.FC<UserMessageContentProps> = ({ text, className }) => {
  const dispatch = useAppDispatch();
  const docNameMap = useScopedDocNameMap();
  const safeText = typeof text === 'string' ? text : String(text ?? '');
  if (!safeText.trim()) return null;

  const nodes = parseCitationNodes(safeText);

  return (
    <span className={className}>
      {nodes.map((node, index) => {
        if (typeof node === 'string') {
          return <React.Fragment key={`user-text-${index}`}>{node}</React.Fragment>;
        }
        return (
          <CitationTag
            key={`user-citation-${node.label}-${node.type}-${node.pages.join('|')}-${index}`}
            label={node.label}
            type={node.type}
            page={node.page}
            pages={node.pages}
            docName={docNameMap[node.type]}
            onPageClick={(selectedPage) =>
              dispatch(
                requestCitationJump({
                  source: node.type,
                  pageText: normalizeCitationPageValue(selectedPage),
                })
              )
            }
          />
        );
      })}
    </span>
  );
};

export default UserMessageContent;
