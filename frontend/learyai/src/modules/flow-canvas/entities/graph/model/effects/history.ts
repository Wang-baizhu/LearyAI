/** 责任：维护白板图历史快照的创建与裁剪逻辑。 */
import { HISTORY_LIMIT } from './constants';
import type { EdgeChange, NodeChange } from '@xyflow/react';
import type { AppNode, GraphSnapshot, GraphState } from '../types';

export const createSnapshot = (state: Pick<GraphState, 'nodes' | 'edges'>): GraphSnapshot => ({
  nodes: state.nodes,
  edges: state.edges,
});

export const pushSnapshot = (history: GraphSnapshot[], snapshot: GraphSnapshot) => [
  ...history.slice(-(HISTORY_LIMIT - 1)),
  snapshot,
];

export const shouldTrackNodeChanges = (changes: NodeChange<AppNode>[]) =>
  changes.some((change) => change.type !== 'select' && change.type !== 'dimensions');

export const shouldTrackEdgeChanges = (changes: EdgeChange[]) =>
  changes.some((change) => change.type !== 'select');
