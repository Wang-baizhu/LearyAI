// modules/knowledge-base/features/delete 对外统一出口，收敛 slice 间依赖路径。
export { knowledgeBaseDeleteApi } from './api/knowledgeBaseDeleteApi';
export { useDeleteKnowledgeBase } from './model/useDeleteKnowledgeBase';
