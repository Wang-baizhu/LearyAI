// types 负责定义资源中心列表态的共享类型。
import type { ResourceListItem } from '../../../../kbdoc';

type ResourceCenterAggregatedGroup = {
  key: string;
  label: string;
  icon?: string;
  panel: string;
  total: number;
  items?: ResourceListItem[];
  page?: number;
  size?: number;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
};

export interface ResourceCenterListState {
  gridItems: ResourceListItem[];
  itemCount: number;
  availableTemplateTags?: string[];
  availableTemplateSources?: string[];
  isGridLoading: boolean;
  isGridError: boolean;
  gridErrorMessage: string;
  totalPages: number;
  kind: 'resource' | 'template' | 'mixed';
  isKnowledgeTab: boolean;
  aggregatedGroups: ResourceCenterAggregatedGroup[];
  page: number;
  showPagination: boolean;
  sections?: ResourceCenterAggregatedGroup[];
}
