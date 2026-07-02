// modules/project/features/rename 对外统一出口，收敛 slice 间依赖路径。
export { default } from './ui/RenameProjectForm';
export { projectRenameApi } from './api/projectRenameApi';
export type { ProjectRenamePayload } from './api/projectRenameApi';
export { useRenameProject } from './model/useRenameProject';
export { default as RenameProjectForm } from './ui/RenameProjectForm';

