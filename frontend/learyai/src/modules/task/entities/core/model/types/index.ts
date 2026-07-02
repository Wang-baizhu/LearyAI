// types 负责定义通用任务列表相关类型。
export type TaskStatus = 'UPLOADING' | 'UPLOADED' | 'PROCESSING' | 'DONE' | 'FAILED';

export interface TaskListItem {
  taskId: string;
  type: string;
  typeId: string;
  status: TaskStatus;
  currentStage?: string | null;
  viewData?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskListResponse {
  items: TaskListItem[];
  total: number;
  page: number;
  size: number;
}

export interface TaskListParams {
  projectId?: string;
  kbId?: string;
  types?: string[];
  statuses?: TaskStatus[];
  page?: number;
  size?: number;
}

export interface TaskCreateRequest {
  projectId: string;
  kbId: string;
  type: string;
  typeId: string;
  status: TaskStatus;
  pipelineContext?: Record<string, unknown>;
  info?: string;
  changeType?: string;
}

export interface TaskDetailResponse {
  taskId: string;
  projectId: string;
  userId: number;
  type: string;
  typeId: string;
  status: TaskStatus;
  currentStage?: string | null;
  viewData?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface RetryFailedTaskRequest {
  taskId: string;
  projectId: string;
  kbId: string;
}
