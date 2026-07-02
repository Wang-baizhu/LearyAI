// modules/project 作为项目模块统一出口，收敛跨模块依赖引用。
export type { Project, ProjectMember } from './entities';
export type { ProjectCreatePayload } from './features';
export {
  useProjects,
  useCreateProject,
  useDeleteProject,
  useRenameProject,
  useProjectMembers,
  useRemoveProjectMember,
  useLeaveProject,
  useTransferProjectOwner,
  useUpdateProjectMemberRole,
  useCreateProjectInvite,
  useAcceptProjectInvite,
  CreateProjectForm,
  RenameProjectForm,
  ProjectInviteJoinForm,
} from './features';
export { default as ProjectDetailPage } from './pages/project-detail';
export { default as ProjectDetailSidebar } from './widgets/project-detail';
