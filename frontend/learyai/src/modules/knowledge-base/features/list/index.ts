// modules/knowledge-base/features/list 对外统一出口，收敛 slice 间依赖路径。
export { knowledgeBaseListApi } from './api/knowledgeBaseListApi';
export type { KnowledgeBaseListParams } from './api/knowledgeBaseListApi';
export { useKnowledgeBaseList } from './model/useKnowledgeBaseList';
