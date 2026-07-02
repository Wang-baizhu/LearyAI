// KnowledgeBase 类型定义用于知识库实体相关的数据结构。
export type KnowledgeBaseVisibility = 'PUBLIC' | 'TEAM' | 'PRIVATE';

export interface KnowledgeBase {
  kbId: string;
  name: string;
  description?: string | null;
  tags: string[];
  enabledTemplatePluginIds: string[];
  userId: number;
  visibility: KnowledgeBaseVisibility;
  visitedAt?: string | null;
}
