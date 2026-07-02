# 模块角色
- 提供项目管理全链路：创建/删除/重命名、成员管理、邀请、项目详情页等。
- 通过 `index.ts` 聚合 hooks 与 UI，供路由和其他域复用。

# 目录速览
- `entities/`：项目与成员类型定义。
- `features/*/`：按动作划分（create/delete/rename/list/members/invite），包含 API、hooks、表单 UI。
- `adapter/knowledge-bases/`：项目详情页内部使用的知识库适配层，负责把 `knowledge-base` 模块的列表与增删改能力收敛为项目侧管理契约。
- `pages/project-detail/`：项目详情页容器。
- `widgets/project-detail/`：项目详情侧边栏组件等。
- 项目详情页已接入引导标签 `guide:project-detail:v1`：步骤 1 聚焦成员权限侧栏，步骤 2 聚焦右下角新建知识库按钮。

# 对外出口（index.ts）
- 类型：`Project`、`ProjectMember`、`ProjectCreatePayload`。
- Hooks：`useProjects`、`useCreateProject`、`useDeleteProject`、`useRenameProject`、`useProjectMembers`、`useRemoveProjectMember`、`useLeaveProject`、`useTransferProjectOwner`、`useUpdateProjectMemberRole`、`useCreateProjectInvite`、`useAcceptProjectInvite`。
- 组件：`CreateProjectForm`、`RenameProjectForm`、`ProjectInviteJoinForm`、`ProjectDetailPage`、`ProjectDetailSidebar`。
