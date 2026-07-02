// modules/visit 作为最近访问模块统一出口，收敛跨模块依赖引用。
export type { RecentVisitItem, RecentVisitPage, VisitResourceType } from './entities';
export { useRecentVisits } from './features';
