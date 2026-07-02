// useProjectMembers 负责项目成员分页查询与缓存。
import { useQuery } from '@tanstack/react-query';
import { projectMemberApi } from '../../api/projectMemberApi';
import type { ProjectMember } from '../../../../entities';

interface ProjectMemberListResult {
  items: ProjectMember[];
  total: number;
  page: number;
  size: number;
}

export const useProjectMembers = (projectId: string, page = 1, size = 20) =>
  useQuery<ProjectMemberListResult>({
    queryKey: ['project', 'members', projectId, page, size],
    queryFn: () => projectMemberApi.fetchList(projectId, page, size),
    enabled: Boolean(projectId),
  });
