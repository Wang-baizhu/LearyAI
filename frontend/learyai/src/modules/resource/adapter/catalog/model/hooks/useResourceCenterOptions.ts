// useResourceCenterOptions 负责拉取资源中心文档候选项，供名称映射与引用跳转复用。
import { useQuery } from '@tanstack/react-query';
import { useResourceScope } from '../../../../entities/resource-center';
import { resourceCenterOptionsApi } from '../effects/options';

const resourceCenterOptionsKeys = {
  docs: (projectId?: string, kbId?: string) =>
    ['resource-center', 'options', 'docs', projectId ?? 'none', kbId ?? 'none'] as const,
};

export const useResourceCenterOptions = (params?: { projectId?: string; kbId?: string }) => {
  const scope = useResourceScope();
  const projectId = params?.projectId ?? scope.projectId;
  const kbId = params?.kbId ?? scope.kbId;

  return useQuery({
    queryKey: resourceCenterOptionsKeys.docs(projectId, kbId),
    queryFn: async () => {
      if (!projectId || !kbId) {
        return [];
      }
      return resourceCenterOptionsApi.getDocOptions(projectId, kbId);
    },
    enabled: Boolean(projectId) && Boolean(kbId),
  });
};
