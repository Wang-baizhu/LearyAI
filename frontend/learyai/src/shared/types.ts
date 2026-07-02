// shared/types 提供跨模块复用的基础类型定义。
export interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  colorClass: string;
  bgColorClass: string;
}
