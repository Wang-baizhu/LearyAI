// modules/knowledge-base 作为知识库模块统一出口，收敛跨模块依赖引用。
export type { KnowledgeBase, KnowledgeBaseVisibility } from './entities';
export type { KnowledgeBaseFormPayload, KnowledgeBaseCreatePayload } from './features';
export {
  useCreateKnowledgeBase,
  CreateKnowledgeBaseForm,
  useUpdateKnowledgeBase,
  EditKnowledgeBaseForm,
  useDeleteKnowledgeBase,
  useRecentKnowledgeBases,
  useKnowledgeBaseList,
  useKnowledgeBaseDetail,
} from './features';
