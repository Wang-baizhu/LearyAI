// 职责: 统一导出模板插件 React client 与 content 展示能力。
export { createBufferedStorageWriter } from './bufferedStorageWriter';
export { EditableContent } from './content/ui/EditableContent';
export {
  TemplatePluginRuntimeProvider,
  useOptionalTemplatePluginRuntime,
  useTemplatePluginRuntime,
} from './content/runtime/TemplatePluginRuntimeContext';
export { splitContentParts } from './content/lib/content';
export { useTemplatePluginClient } from './useTemplatePluginClient';
export { resetTemplatePluginClientSingletonForHmr } from './useTemplatePluginClient';
export type { ContentPart, ContentReference } from './content/lib/content';
export type { TemplatePluginClient, TemplatePluginClientOptions } from './useTemplatePluginClient';
