// useWorkspaceProjects 负责把项目模块查询适配为工作区可直接消费的项目列表契约。
import { useMemo } from 'react';
import { useProjects } from '../../../../project';
import type { WorkspaceProject, WorkspaceProjectsState } from './types';

const mapWorkspaceProject = (project: WorkspaceProject): WorkspaceProject => ({
  projectId: project.projectId,
  name: project.name,
  role: project.role,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
});

export const useWorkspaceProjects = (
  page = 1,
  size = 20,
  enabled = true
): WorkspaceProjectsState => {
  const projectsQuery = useProjects(page, size, enabled);
  const projects = useMemo(
    () => (projectsQuery.data ?? []).map(mapWorkspaceProject),
    [projectsQuery.data]
  );

  return {
    projects,
    defaultProjectId: projects[0]?.projectId ?? null,
    isLoading: projectsQuery.isLoading,
    isError: projectsQuery.isError,
    error: projectsQuery.error,
  };
};
