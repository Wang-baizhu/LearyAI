// workspace project adapter types 负责定义工作区侧消费项目能力的稳定契约。
import type { Project } from '../../../../project';

export type WorkspaceProject = Project;

export interface WorkspaceProjectsState {
  projects: WorkspaceProject[];
  defaultProjectId: string | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}
