// FlowCanvasDemoPage 负责保留白板模块的演示页组装示例。
import { Whiteboard } from '../../../widgets/whiteboard';
import type { AppNode } from '../../../entities/graph';

const SAMPLE_NODES: AppNode[] = [
  {
    id: '1',
    position: { x: 250, y: 150 },
    data: { label: '战略规划', tags: ['核心', '管理'], description: '中心枢纽' },
    type: 'resizable',
  },
  {
    id: '2',
    position: { x: 500, y: 100 },
    data: { label: '技术架构', tags: ['核心', '技术'], description: '分布式系统' },
    type: 'resizable',
  },
  {
    id: '3',
    position: { x: 450, y: 300 },
    data: { label: '市场调研', tags: ['市场'], description: '用户洞察' },
    type: 'resizable',
  },
  {
    id: '4',
    position: { x: 100, y: 300 },
    data: { label: '📝 重要区域', tags: ['注释'], description: '此区域仅供参考' },
    type: 'annotation',
  }
];

const SAMPLE_EDGES = [
  { id: 'e1-2', source: '1', target: '2', label: '包含' },
  { id: 'e1-3', source: '1', target: '3', label: '驱动' },
];

export default function FlowCanvasDemoPage() {
  return (
    <div id="app-container" className="w-screen h-screen">
      <Whiteboard 
        initialNodes={SAMPLE_NODES}
        initialEdges={SAMPLE_EDGES}
        className="whiteboard-instance"
      />
    </div>
  );
}
