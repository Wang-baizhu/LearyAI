// 职责: 提供 EditableContent 默认正文与引用标签渲染。
import type { ReactNode } from 'react';
import { ReferenceTag } from '../internal/ReferenceTag';
import { resolveReferenceDocName } from '../lib/editableContent';
import type { ContentPart } from '../lib/content';
import type { EditableContentExtension, ReferenceJumpPayload } from '../types';

export const renderDefaultContent = <TContext,>({
  parts,
  textClassName,
  referenceTitleMap,
  referenceDisabled,
  requestReferenceJump,
  extensions,
  context,
}: {
  parts: ContentPart[];
  textClassName?: string;
  referenceTitleMap?: Record<string, string>;
  referenceDisabled: boolean;
  requestReferenceJump: (payload: ReferenceJumpPayload) => void;
  extensions: EditableContentExtension<unknown, TContext>[];
  context?: TContext;
}) => (
  <span className={textClassName} style={{ whiteSpace: 'pre-wrap' }}>
    {parts.map((part, index) => {
      if (part.kind === 'text') {
        const customTextPart = extensions.reduce<ReactNode | null | undefined>(
          (resolved, extension) =>
            resolved ??
            extension.renderTextPart?.({
              text: part.value,
              index,
              context,
            }),
          undefined,
        );

        return <span key={`text-${index}`}>{customTextPart ?? part.value}</span>;
      }

      const docName = resolveReferenceDocName(part.value, referenceTitleMap);
      const defaultReferenceNode = (
        <ReferenceTag
          key={`reference-${part.value.raw}-${index}`}
          label={part.value.label}
          source={part.value.source}
          page={part.value.page}
          pages={part.value.pages}
          docName={docName}
          disabled={referenceDisabled}
          onPageClick={(payload) =>
            requestReferenceJump({
              label: payload.label,
              source: payload.source,
              page: payload.page,
              pageValue: payload.pageValue,
            })
          }
        />
      );
      const customReference = extensions.reduce<ReactNode | null | undefined>(
        (resolved, extension) =>
          resolved ??
          extension.renderReference?.({
            reference: part.value,
            docName,
            disabled: referenceDisabled,
            defaultNode: defaultReferenceNode,
            requestReferenceJump,
            context,
          }),
        undefined,
      );

      return <span key={`reference-${part.value.raw}-${index}`}>{customReference ?? defaultReferenceNode}</span>;
    })}
  </span>
);
