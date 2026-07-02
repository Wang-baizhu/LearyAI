// 职责: 提供面向 content 语义的模板插件展示组件编排入口。
import type { ReactNode } from 'react';
import { EditableText } from '@leary/text-editable';
import { useTemplatePluginClient } from '../../useTemplatePluginClient';
import { resolveBehavior, joinClassNames } from '../lib/editableContent';
import { splitContentParts } from '../lib/content';
import { useOptionalTemplatePluginRuntime } from '../runtime/TemplatePluginRuntimeContext';
import { renderDefaultContent } from './renderDefaultContent';
import type { EditableContentExtension, EditableContentProps, EditableContentRenderParams, ReferenceJumpPayload } from '../types';

export const EditableContent = <TAnchor, TContext = unknown>({
  title,
  content,
  anchor,
  multiline = true,
  className,
  contentClassName,
  triggerClassName,
  triggerPlacement = 'overlay',
  textClassName,
  referenceDisabled = false,
  renderContent,
  extensions = [],
  context,
}: EditableContentProps<TAnchor, TContext>) => {
  const client = useTemplatePluginClient();
  const runtime = useOptionalTemplatePluginRuntime<TAnchor>();
  const parts = splitContentParts(content);
  const runtimeAnchor =
    anchor ??
    runtime?.resolveContentAnchor?.({
      pluginId: runtime.pluginId,
      templateId: runtime.templateId,
      rawContent: runtime.rawContent,
      content,
    });
  const resolvedPluginId = runtime?.pluginId ?? '';
  const behavior = resolveBehavior({
    pluginId: resolvedPluginId,
    title,
    content,
    anchor: runtimeAnchor,
    multiline,
    extensions,
    context,
  });
  const resolvedTitle = behavior.title ?? title;
  const resolvedContent = behavior.content ?? content;
  const resolvedAnchor = behavior.anchor ?? runtimeAnchor;
  const resolvedMultiline = behavior.multiline ?? multiline;
  const resolvedReferenceTitleMap = runtime?.referenceTitleMap;
  const resolveEditedContent = runtime?.resolveEditedContent;
  const editDisabled =
    Boolean(behavior.disabled) || resolvedAnchor == null || resolvedPluginId.trim().length === 0;
  const resolvedReferenceDisabled = referenceDisabled || Boolean(behavior.disabled);

  const requestReferenceJump = (payload: ReferenceJumpPayload) => {
    if (resolvedReferenceDisabled) {
      return;
    }
    void client.requestCitationJump({
      source: payload.source,
      pageText: payload.pageValue,
      label: payload.label,
      page: payload.page,
    });
  };

  const defaultContent = renderDefaultContent<TContext>({
    parts,
    textClassName,
    referenceTitleMap: resolvedReferenceTitleMap,
    referenceDisabled: resolvedReferenceDisabled,
    requestReferenceJump,
    extensions: extensions as EditableContentExtension<unknown, TContext>[],
    context,
  });
  const renderParams: EditableContentRenderParams<TAnchor, TContext> = {
    pluginId: resolvedPluginId,
    title: resolvedTitle,
    content: resolvedContent,
    anchor: resolvedAnchor,
    multiline: resolvedMultiline,
    context,
    parts,
    referenceTitleMap: resolvedReferenceTitleMap,
    referenceDisabled: resolvedReferenceDisabled,
    defaultContent,
    requestReferenceJump,
  };
  const extensionContent = extensions.reduce<ReactNode | null | undefined>(
    (resolved, extension) => resolved ?? extension.renderContent?.(renderParams),
    undefined,
  );
  const finalContent = renderContent?.(renderParams) ?? extensionContent ?? defaultContent;
  const extensionClassNames = extensions.reduce(
    (resolved, extension) => ({
      root: joinClassNames(resolved.root, extension.classNames?.root),
      content: joinClassNames(resolved.content, extension.classNames?.content),
      trigger: joinClassNames(resolved.trigger, extension.classNames?.trigger),
      text: joinClassNames(resolved.text, extension.classNames?.text),
    }),
    {
      root: '',
      content: '',
      trigger: '',
      text: '',
    },
  );

  if (behavior.hidden) {
    return null;
  }

  if (editDisabled) {
    return (
      <div className={joinClassNames(className, extensionClassNames.root)}>
        <div className={joinClassNames(contentClassName, extensionClassNames.content)}>
          {finalContent}
        </div>
      </div>
    );
  }

  return (
    <EditableText
      title={resolvedTitle}
      value={resolvedContent}
      anchor={resolvedAnchor as TAnchor}
      className={joinClassNames(className, extensionClassNames.root)}
      contentClassName={joinClassNames(contentClassName, extensionClassNames.content)}
      triggerClassName={joinClassNames(triggerClassName, extensionClassNames.trigger)}
      triggerPlacement={triggerPlacement}
      onRequestEdit={async ({ title: requestTitle, value: requestValue, anchor: requestAnchor }) => {
        if (behavior.disabled) {
          return;
        }
        const response = await client.requestTextEdit({
          title: requestTitle,
          value: requestValue,
          multiline: resolvedMultiline,
          anchor: requestAnchor,
        });
        if (
          !response.success ||
          typeof response.value !== 'string' ||
          !resolveEditedContent ||
          requestAnchor == null
        ) {
          return;
        }
        const nextContent = resolveEditedContent({
          pluginId: resolvedPluginId,
          templateId: runtime?.templateId ?? '',
          rawContent: runtime?.rawContent ?? '',
          anchor: requestAnchor as TAnchor,
          previousValue: requestValue,
          nextValue: response.value,
        });
        await client.requestSaveContent({
          content: nextContent,
        });
      }}
    >
      {finalContent}
    </EditableText>
  );
};
