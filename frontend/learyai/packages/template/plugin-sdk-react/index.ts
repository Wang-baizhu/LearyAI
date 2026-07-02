// index 负责转发 template-plugin-sdk-react 包的公开入口。
export { createBufferedStorageWriter } from './src/bufferedStorageWriter';
export { EditableContent } from './src/content/ui/EditableContent';
export {
  TemplatePluginRuntimeProvider,
  useOptionalTemplatePluginRuntime,
  useTemplatePluginRuntime,
} from './src/content/runtime/TemplatePluginRuntimeContext';
export { splitContentParts } from './src/content/lib/content';
export { useTemplatePluginClient } from './src/useTemplatePluginClient';
export { resetTemplatePluginClientSingletonForHmr } from './src/useTemplatePluginClient';
export type { ContentPart, ContentReference } from './src/content/lib/content';
export type { TemplatePluginClient, TemplatePluginClientOptions } from './src/useTemplatePluginClient';
