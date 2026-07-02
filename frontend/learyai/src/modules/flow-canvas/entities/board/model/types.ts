// types 负责定义 flow-canvas 持久化快照、资源目录与组件事件类型。
import type { Edge, Viewport } from '@xyflow/react';
import type { AppNode } from '../../graph';

export interface FlowCanvasSnapshot {
  version: number;
  nodes: AppNode[];
  edges: Edge[];
  viewport?: Viewport;
}

export interface FlowCanvasBoardState {
  boardId: string;
  title: string;
  snapshot: FlowCanvasSnapshot;
}

export interface FlowCanvasResourceDoc {
  docId: string;
  name: string;
  status?: string;
}

export interface FlowCanvasResourceTemplate {
  templateId: string;
  name: string;
  pluginId?: string;
  type?: string;
  visibility?: string;
  source?: string[];
}

export interface FlowCanvasResourceCatalog {
  docs: FlowCanvasResourceDoc[];
  templates: FlowCanvasResourceTemplate[];
}

export interface FlowCanvasViewState {
  isLoading?: boolean;
  isError?: boolean;
  isSaving?: boolean;
  saveError?: boolean;
}

export type FlowCanvasEvent =
  | {
      type: 'snapshotChanged';
      snapshot: FlowCanvasSnapshot;
    }
  | {
      type: 'nodeOpened';
      nodeId: string;
      label?: string;
      refKind?: 'kbdoc' | 'template';
      refId?: string;
    };
