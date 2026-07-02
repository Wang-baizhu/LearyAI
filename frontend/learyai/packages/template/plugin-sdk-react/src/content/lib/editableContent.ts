// 职责: 提供 EditableContent 组件内部复用的行为解析与样式合并能力。
import type { ContentReference } from './content';
import type {
  EditableContentBehavior,
  EditableContentBehaviorParams,
  EditableContentExtension,
} from '../types';

export const joinClassNames = (...values: Array<string | undefined>) => values.filter(Boolean).join(' ');

export const resolveReferenceDocName = (
  reference: ContentReference,
  referenceTitleMap?: Record<string, string>,
) => referenceTitleMap?.[reference.source] ?? referenceTitleMap?.[reference.label];

export const resolveBehavior = <TAnchor, TContext>({
  pluginId,
  title,
  content,
  anchor,
  multiline,
  extensions,
  context,
}: EditableContentBehaviorParams<TAnchor, TContext> & {
  extensions: EditableContentExtension<TAnchor, TContext>[];
}): EditableContentBehavior<TAnchor> =>
  extensions.reduce<EditableContentBehavior<TAnchor>>((result, extension) => {
    const patch = extension.resolveBehavior?.({
      pluginId,
      title,
      content,
      anchor,
      multiline,
      context,
    });

    if (!patch) {
      return result;
    }

    return {
      ...result,
      ...patch,
    };
  }, {});
