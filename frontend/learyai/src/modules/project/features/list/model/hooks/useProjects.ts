// useProjects 负责项目列表的查询与缓存。
import { useQuery } from '@tanstack/react-query';
import { projectListApi } from '../../api/projectListApi';
import type { Project } from '../../../../entities';

export const useProjects = (page = 1, size = 20, enabled = true) =>
  useQuery<Project[]>({
    queryKey: ['projects', 'list', page, size],
    queryFn: () => projectListApi.fetchList(page, size),
    enabled,
  });
