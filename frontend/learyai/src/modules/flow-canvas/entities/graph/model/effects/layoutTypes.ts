/** 责任：定义白板布局算法内部共享类型。 */
import type { AppNode } from '../types';

export interface LayoutPoint {
  x: number;
  y: number;
}

export interface LayoutNodeDraft {
  node: AppNode;
  position: LayoutPoint;
  width: number;
  height: number;
}
