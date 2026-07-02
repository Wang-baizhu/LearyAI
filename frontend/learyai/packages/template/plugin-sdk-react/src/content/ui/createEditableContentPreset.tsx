// 职责: 提供基于默认上下文与扩展的 EditableContent 预设工厂。
import { EditableContent } from './EditableContent';
import type { EditableContentExtension, EditableContentPresetConfig, EditableContentProps } from '../types';

export const createEditableContentPreset = <TAnchor, TContext = unknown>({
  useContext,
  extensions = [],
}: EditableContentPresetConfig<TAnchor, TContext>) => {
  const PresetEditableContent = (
    props: Omit<EditableContentProps<TAnchor, TContext>, 'context' | 'extensions'> & {
      extensions?: EditableContentExtension<TAnchor, TContext>[];
    },
  ) => {
    const context = useContext?.();

    return (
      <EditableContent
        {...props}
        context={context}
        extensions={[...extensions, ...(props.extensions ?? [])]}
      />
    );
  };

  return PresetEditableContent;
};
