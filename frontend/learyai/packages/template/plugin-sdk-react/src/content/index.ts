// 职责: 聚合导出模板插件 content 展示组件的公开能力。
export { EditableContent } from './ui/EditableContent';
export {
  TemplatePluginRuntimeProvider,
  useOptionalTemplatePluginRuntime,
  useTemplatePluginRuntime,
} from './runtime/TemplatePluginRuntimeContext';
export { splitContentParts } from './lib/content';
export type { ContentPart, ContentReference } from './lib/content';
