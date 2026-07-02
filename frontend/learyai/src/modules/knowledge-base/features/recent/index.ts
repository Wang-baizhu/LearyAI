// modules/knowledge-base/features/recent 对外统一出口，收敛 slice 间依赖路径。
export { knowledgeBaseRecentApi } from './api/knowledgeBaseRecentApi';
export { useRecentKnowledgeBases } from './model/useRecentKnowledgeBases';
