// modules/task 作为任务模块统一出口，收敛跨模块依赖引用。
export { default as TaskListButton } from './features/task-list';
export { default as ResourceGenerateTaskModal } from './widgets';
export { taskApi, useTaskList } from './entities';
export {
  ensureTaskSseConnected,
  closeTaskSse,
  ensureTaskSseReady,
} from './entities';
export type {
  TaskCreateRequest,
  TaskListItem,
  TaskListParams,
  TaskListResponse,
  TaskStatus,
} from './entities';
