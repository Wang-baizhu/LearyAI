// 责任：管理管理员模板开发调试安装包版本列表、上传与激活动作状态。
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { templateDevPackageApi } from '../api/templateDevPackage.api';

const TEMPLATE_DEV_PACKAGE_QUERY_KEY = ['template-dev-package', 'versions'] as const;

export function useTemplateDevPackageVersions() {
  const query = useQuery({
    queryKey: TEMPLATE_DEV_PACKAGE_QUERY_KEY,
    queryFn: () => templateDevPackageApi.listVersions(),
  });

  return {
    ...query,
    versions: query.data?.data ?? [],
  };
}

export function useUploadTemplateDevPackageVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: templateDevPackageApi.uploadVersion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEMPLATE_DEV_PACKAGE_QUERY_KEY });
    },
  });
}

export function useActivateTemplateDevPackageVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: templateDevPackageApi.activateVersion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEMPLATE_DEV_PACKAGE_QUERY_KEY });
    },
  });
}
