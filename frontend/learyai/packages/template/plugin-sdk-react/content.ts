// content 负责暴露模板插件 content 组件的公开子入口。
export { EditableContent } from './src/content/ui/EditableContent';
export {
  TemplatePluginRuntimeProvider,
  useOptionalTemplatePluginRuntime,
  useTemplatePluginRuntime,
} from './src/content/runtime/TemplatePluginRuntimeContext';
export { splitContentParts } from './src/content/lib/content';
export type { ContentPart, ContentReference } from './src/content/lib/content';
export type {
  EditableContentExtension,
  EditableContentProps,
  EditableContentRenderParams,
} from './src/content/types';
