import { useKbdocList } from '@/modules/kbdoc';
import type {
  ResourceCenterStaticPanel,
  ResourceCenterTab,
} from '../../../../entities/resource-center';
import { isResourceCenterTab } from '../../../../entities/resource-center';
import type { ResourceCenterListState } from '../../../../features/resource-center-list';

interface UseResourceCatalogParams {
  search: string;
  fileType: string;
  activePage: number;
  dockedPage: number;
  size: number;
  kbId?: string;
  projectId?: string;
  activeTab: ResourceCenterTab;
  dockedPanel: ResourceCenterStaticPanel;
}

const buildListState = (
  panel: ResourceCenterTab,
  page: number,
  size: number,
  kbdocListQuery: ReturnType<typeof useKbdocList>,
): ResourceCenterListState => {
  const isKnowledgeTab = panel === 'kbdoc';
  const isAllTab = panel === 'all';

  if (isAllTab) {
    const docSection = {
      key: 'docs',
      panel: 'kbdoc',
      label: '参考文档',
      icon: 'book_2',
      isTemplate: false,
      items: (kbdocListQuery.isLoading || kbdocListQuery.isFetching) ? [] : kbdocListQuery.data?.items ?? [],
      total: kbdocListQuery.data?.total ?? 0,
      page,
      size,
      isLoading: kbdocListQuery.isLoading || kbdocListQuery.isFetching,
      isError: kbdocListQuery.isError,
      errorMessage: '文档加载失败，请稍后重试。',
    };
    return {
      gridItems: [],
      itemCount: docSection.total,
      isGridLoading: docSection.isLoading,
      isGridError: docSection.isError,
      gridErrorMessage: docSection.errorMessage,
      totalPages: docSection.total > 0 ? Math.ceil(docSection.total / docSection.size) : 1,
      kind: 'mixed',
      isKnowledgeTab: false,
      availableTemplateTags: [],
      availableTemplateSources: [],
      aggregatedGroups: [docSection],
      page,
      showPagination: true,
      sections: [docSection],
    };
  }

  if (isKnowledgeTab) {
    const isGridLoading = kbdocListQuery.isLoading || kbdocListQuery.isFetching;
    return {
      gridItems: isGridLoading ? [] : kbdocListQuery.data?.items ?? [],
      itemCount: kbdocListQuery.data?.total ?? 0,
      isGridLoading,
      isGridError: kbdocListQuery.isError,
      gridErrorMessage: '文档加载失败，请稍后重试。',
      totalPages: kbdocListQuery.data
        ? Math.ceil(kbdocListQuery.data.total / kbdocListQuery.data.size)
        : 1,
      kind: 'resource',
      isKnowledgeTab: true,
      availableTemplateTags: [],
      availableTemplateSources: [],
      aggregatedGroups: [],
      page,
      showPagination: true,
    };
  }
  return {
    gridItems: [],
    itemCount: 0,
    isGridLoading: false,
    isGridError: false,
    gridErrorMessage: '文档加载失败，请稍后重试。',
    totalPages: 1,
    kind: 'resource',
    isKnowledgeTab: false,
    availableTemplateTags: [],
    availableTemplateSources: [],
    aggregatedGroups: [],
    page,
    showPagination: true,
  };
};

export const useResourceCatalog = ({
  search,
  fileType,
  activePage,
  dockedPage,
  size,
  kbId,
  projectId,
  activeTab,
  dockedPanel,
}: UseResourceCatalogParams) => {
  const activeQueries = useKbdocList({
    search: search || undefined,
    fileType: fileType === 'all' ? undefined : fileType,
    page: activePage,
    size,
    kbId,
    projectId,
  }, { enabled: activeTab === 'all' || activeTab === 'kbdoc' });
  const dockedQueries = useKbdocList({
    search: search || undefined,
    fileType: fileType === 'all' ? undefined : fileType,
    page: dockedPage,
    size,
    kbId,
    projectId,
  }, { enabled: dockedPanel === 'all' || dockedPanel === 'kbdoc' });

  return {
    listState: buildListState(activeTab, activePage, size, activeQueries),
    dockedListState: isResourceCenterTab(dockedPanel)
      ? buildListState(dockedPanel, dockedPage, size, dockedQueries)
      : null,
    kbdocListQuery: activeQueries,
  };
};
