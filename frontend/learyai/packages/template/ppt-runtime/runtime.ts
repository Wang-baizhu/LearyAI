// 职责：提供不依赖 React 的 PPT 模板运行时公开入口，供非 React 模板和工具链使用。
export {
  PPT_EDIT_CHANNEL,
  PPT_EDIT_COMMAND_TYPE,
  PPT_EDIT_EVENT_TYPE,
  buildPptEditablePageSrcdoc,
  applyPptEditPatchToHtml,
} from './src/pptEditProtocol';
export { buildPptEditRuntimeScript } from './src/pptEditRuntime';
export { parsePptContent, resolveRenderedPages } from './src/pptContent';
export type {
  PptEditCommandMessage,
  PptEditCommandName,
  PptEditEventMessage,
  PptEditSelectionSnapshot,
  PptEditStylePatch,
  PptEditTargetRect,
} from './src/pptEditProtocol';
export type {
  PptTemplatePage,
  PptTemplateSlot,
  RenderedPptPage,
} from './src/pptContent';
