// mock.ts 负责提供资源中心全局视图白板的默认 mock 数据。
import type { Edge } from '@xyflow/react';
import type { AppNode } from '../../graph/model';

export interface FlowCanvasBoard {
  boardId: string;
  title: string;
  nodes: AppNode[];
  edges: Edge[];
}

export const DEFAULT_FLOW_CANVAS_BOARD: FlowCanvasBoard = {
  boardId: 'resource-global-view',
  title: '全局视图',
  nodes: [
    {
      id: 'resource-center',
      position: { x: 320, y: 180 },
      data: { label: '资源中心', tags: ['核心', '入口'], description: '所有资源与模板的汇聚视图' },
      type: 'resizable',
    },
    {
      id: 'references',
      position: { x: 80, y: 60 },
      data: { label: '参考文档', tags: ['文档'], description: '后续会接入知识库文档节点' },
      type: 'resizable',
    },
    {
      id: 'mindmap-template',
      position: { x: 620, y: 40 },
      data: { label: '思维导图', tags: ['模板'], description: '展示模板编排节点' },
      type: 'resizable',
    },
    {
      id: 'quiz-template',
      position: { x: 620, y: 220 },
      data: { label: '题目模板', tags: ['模板'], description: '可扩展为题目生成流' },
      type: 'resizable',
    },
    {
      id: 'card-template',
      position: { x: 620, y: 400 },
      data: { label: '卡片模板', tags: ['模板'], description: '用于记忆卡片编排' },
      type: 'resizable',
    },
    {
      id: 'stage-note',
      position: { x: 40, y: 340 },
      data: { label: '📝 当前阶段', tags: ['注释'], description: '先跑通 mock，后续再接外部传入节点' },
      type: 'annotation',
    },
  ],
  edges: [
    { id: 'edge-reference', source: 'references', target: 'resource-center', label: '输入' },
    { id: 'edge-mindmap', source: 'resource-center', target: 'mindmap-template', label: '生成' },
    { id: 'edge-quiz', source: 'resource-center', target: 'quiz-template', label: '派生' },
    { id: 'edge-card', source: 'resource-center', target: 'card-template', label: '沉淀' },
  ],
};
