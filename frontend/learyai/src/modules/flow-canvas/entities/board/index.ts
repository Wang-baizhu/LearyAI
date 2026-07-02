// entities/board 对外导出白板板面实体与 mock 数据。
export { DEFAULT_FLOW_CANVAS_BOARD } from './model/mock';
export type { FlowCanvasBoard } from './model/mock';
export {
  mergeCanvasWithResourceCatalog,
  mergeCanvasWithResourceOptions,
  parseFlowCanvasSnapshot,
} from './model/effects/merge';
export type {
  FlowCanvasEvent,
  FlowCanvasBoardState,
  FlowCanvasResourceCatalog,
  FlowCanvasResourceDoc,
  FlowCanvasResourceTemplate,
  FlowCanvasSnapshot,
  FlowCanvasViewState,
} from './model/types';
