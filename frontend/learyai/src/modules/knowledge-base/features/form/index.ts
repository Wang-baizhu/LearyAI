// modules/knowledge-base/features/form 对外统一出口，收敛 slice 间依赖路径。
export { default } from './ui/KnowledgeBaseForm';
export { default as KnowledgeBaseForm } from './ui/KnowledgeBaseForm';
export type { KnowledgeBaseFormPayload, KnowledgeBaseFormValues } from './ui/KnowledgeBaseForm';
