// modules/knowledge-base/features/update 对外统一出口，收敛 slice 间依赖路径。
export { default } from './ui/EditKnowledgeBaseForm';
export { knowledgeBaseUpdateApi } from './api/knowledgeBaseUpdateApi';
export type { KnowledgeBaseUpdatePayload } from './api/knowledgeBaseUpdateApi';
export { useUpdateKnowledgeBase } from './model/useUpdateKnowledgeBase';
export { default as EditKnowledgeBaseForm } from './ui/EditKnowledgeBaseForm';

