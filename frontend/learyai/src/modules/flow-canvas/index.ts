// modules/flow-canvas 对外统一导出白板 detail-page 能力。
export {
  DEFAULT_FLOW_CANVAS_BOARD,
  mergeCanvasWithResourceCatalog,
  parseFlowCanvasSnapshot,
} from './entities/board';
export type {
  FlowCanvasBoard,
  FlowCanvasEvent,
  FlowCanvasResourceCatalog,
  FlowCanvasSnapshot,
  FlowCanvasViewState,
} from './entities/board';
export { default as FlowCanvasDetailView } from './widgets/detail-view';
