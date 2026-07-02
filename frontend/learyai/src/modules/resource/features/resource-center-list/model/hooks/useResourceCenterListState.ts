// useResourceCenterListState 负责转发资源中心列表适配层 Hook，兼容既有导入路径。
import { useResourceCatalog } from '../../../../adapter/catalog/model/hooks/useResourceCatalog';
import type { ResourceCenterStaticPanel, ResourceCenterTab } from '../../../../entities/resource-center';

interface UseResourceCenterListStateParams {
  search: string;
  fileType: string;
  activeSelectedTemplateTag: string | null;
  activeSelectedTemplateSource: string | null;
  dockedSelectedTemplateTag: string | null;
  dockedSelectedTemplateSource: string | null;
  enabledTemplatePlugins?: unknown;
  activePage: number;
  dockedPage: number;
  size: number;
  kbId?: string;
  projectId?: string;
  activeTab: ResourceCenterTab;
  dockedPanel: ResourceCenterStaticPanel;
}

const useResourceCenterListState = ({
  enabledTemplatePlugins: _enabledTemplatePlugins,
  ...params
}: UseResourceCenterListStateParams) => {
  void _enabledTemplatePlugins;
  return useResourceCatalog(params);
};

export default useResourceCenterListState;
