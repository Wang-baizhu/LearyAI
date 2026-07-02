// modules/knowledge-base/features/create 对外统一出口，收敛 slice 间依赖路径。
export { default } from './ui/CreateKnowledgeBaseForm';
export { knowledgeBaseCreateApi } from './api/knowledgeBaseCreateApi';
export type { KnowledgeBaseCreatePayload } from './api/knowledgeBaseCreateApi';
export { useCreateKnowledgeBase } from './model/useCreateKnowledgeBase';
export { default as CreateKnowledgeBaseForm } from './ui/CreateKnowledgeBaseForm';

