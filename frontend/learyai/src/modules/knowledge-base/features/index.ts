// modules/knowledge-base/features 对外统一出口，收敛 slice 间依赖路径。
export { default } from './form';
export { CreateKnowledgeBaseForm, knowledgeBaseCreateApi, useCreateKnowledgeBase } from './create';
export type { KnowledgeBaseCreatePayload } from './create';
export { knowledgeBaseDeleteApi, useDeleteKnowledgeBase } from './delete';
export { knowledgeBaseDetailApi, useKnowledgeBaseDetail } from './detail';
export type { KnowledgeBaseFormPayload, KnowledgeBaseFormValues } from './form';
export { knowledgeBaseListApi, useKnowledgeBaseList } from './list';
export type { KnowledgeBaseListParams } from './list';
export { knowledgeBaseRecentApi, useRecentKnowledgeBases } from './recent';
export { EditKnowledgeBaseForm, knowledgeBaseUpdateApi, useUpdateKnowledgeBase } from './update';
export type { KnowledgeBaseUpdatePayload } from './update';
export { default as KnowledgeBaseForm } from './form';
