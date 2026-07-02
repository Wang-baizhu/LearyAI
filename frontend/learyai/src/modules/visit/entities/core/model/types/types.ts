// Visit 类型定义用于最近访问内容实体相关的数据结构。
export type VisitResourceType = 'PROJECT' | 'KB';

export interface RecentVisitItem {
  resourceType: VisitResourceType;
  resourceId: string;
  visitedAt?: string | null;
  available: boolean;
  title?: string | null;
  description?: string | null;
  projectId?: string | null;
  kbId?: string | null;
}

export interface RecentVisitPage {
  items: RecentVisitItem[];
  hasMore: boolean;
  nextCursor?: string | null;
}
