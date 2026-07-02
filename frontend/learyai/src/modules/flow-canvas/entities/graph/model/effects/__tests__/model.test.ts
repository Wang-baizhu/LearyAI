// model.test.ts 负责验证白板图模型中的布局与状态隔离逻辑。
import { describe, expect, it } from 'vitest';
import { createGraphStore, estimateEdgeLabelLayout, optimizeGraphLayout, resolveEdgeHandlesForLayout } from '../..';

describe('estimateEdgeLabelLayout', () => {
  it('会为无说明边返回最小占位尺寸', () => {
    expect(estimateEdgeLabelLayout('')).toEqual({
      width: 24,
      height: 24,
    });
  });

  it('会为较长边说明预留更大的布局宽高', () => {
    const shortLabelLayout = estimateEdgeLabelLayout('包含');
    const longLabelLayout = estimateEdgeLabelLayout('这是一条需要在自动布局时被考虑的边说明文本');

    expect(longLabelLayout.width).toBeGreaterThan(shortLabelLayout.width);
    expect(longLabelLayout.height).toBeGreaterThanOrEqual(shortLabelLayout.height);
  });
});

describe('resolveEdgeHandlesForLayout', () => {
  it('横向布局时会优先使用左右连接点', () => {
    expect(
      resolveEdgeHandlesForLayout(
        { x: 100, y: 100 },
        { x: 300, y: 120 }
      )
    ).toEqual({
      sourceHandle: 'r-s',
      targetHandle: 'l-t',
    });
  });

  it('纵向布局时会优先使用上下连接点', () => {
    expect(
      resolveEdgeHandlesForLayout(
        { x: 200, y: 300 },
        { x: 220, y: 80 }
      )
    ).toEqual({
      sourceHandle: 't-s',
      targetHandle: 'b-t',
    });
  });

  it('同类型资源节点之间会优先使用上下连接点', () => {
    expect(
      resolveEdgeHandlesForLayout(
        { x: 100, y: 100 },
        { x: 320, y: 260 },
        {
          id: 'template:quiz-1',
          type: 'resizable',
          position: { x: 0, y: 0 },
          data: { label: '测验 1', resourceKind: 'template', templateType: 'quiz' },
        } as any,
        {
          id: 'template:quiz-2',
          type: 'resizable',
          position: { x: 0, y: 0 },
          data: { label: '测验 2', resourceKind: 'template', templateType: 'quiz' },
        } as any,
      )
    ).toEqual({
      sourceHandle: 'b-s',
      targetHandle: 't-t',
    });
  });

  it('不同类型资源节点之间会优先使用左右连接点', () => {
    expect(
      resolveEdgeHandlesForLayout(
        { x: 100, y: 240 },
        { x: 300, y: 80 },
        {
          id: 'template:mind-1',
          type: 'resizable',
          position: { x: 0, y: 0 },
          data: { label: '导图 1', resourceKind: 'template', templateType: 'mindmap' },
        } as any,
        {
          id: 'template:quiz-1',
          type: 'resizable',
          position: { x: 0, y: 0 },
          data: { label: '测验 1', resourceKind: 'template', templateType: 'quiz' },
        } as any,
      )
    ).toEqual({
      sourceHandle: 'r-s',
      targetHandle: 'l-t',
    });
  });

  it('kbdoc 指向 mindmap 时会固定使用顶部连接点', () => {
    expect(
      resolveEdgeHandlesForLayout(
        { x: 100, y: 200 },
        { x: 320, y: 60 },
        {
          id: 'kbdoc:doc-1',
          type: 'resizable',
          position: { x: 0, y: 0 },
          data: { label: '文档 1', resourceKind: 'kbdoc' },
        } as any,
        {
          id: 'template:mind-1',
          type: 'resizable',
          position: { x: 0, y: 0 },
          data: { label: '导图 1', resourceKind: 'template', templateType: 'mindmap' },
        } as any,
      )
    ).toEqual({
      sourceHandle: 't-s',
      targetHandle: 'l-t',
    });
  });

  it('kbdoc 指向 quiz 时会固定使用右侧连接点', () => {
    expect(
      resolveEdgeHandlesForLayout(
        { x: 100, y: 200 },
        { x: 320, y: 220 },
        {
          id: 'kbdoc:doc-1',
          type: 'resizable',
          position: { x: 0, y: 0 },
          data: { label: '文档 1', resourceKind: 'kbdoc' },
        } as any,
        {
          id: 'template:quiz-1',
          type: 'resizable',
          position: { x: 0, y: 0 },
          data: { label: '测验 1', resourceKind: 'template', templateType: 'quiz' },
        } as any,
      )
    ).toEqual({
      sourceHandle: 'r-s',
      targetHandle: 'l-t',
    });
  });

  it('kbdoc 指向其他模板类型时会固定使用底部连接点', () => {
    expect(
      resolveEdgeHandlesForLayout(
        { x: 100, y: 200 },
        { x: 320, y: 360 },
        {
          id: 'kbdoc:doc-1',
          type: 'resizable',
          position: { x: 0, y: 0 },
          data: { label: '文档 1', resourceKind: 'kbdoc' },
        } as any,
        {
          id: 'template:card-1',
          type: 'resizable',
          position: { x: 0, y: 0 },
          data: { label: '卡片 1', resourceKind: 'template', templateType: 'card' },
        } as any,
      )
    ).toEqual({
      sourceHandle: 'b-s',
      targetHandle: 'l-t',
    });
  });

  it('较多的连接类型会固定占用目标节点左右连接点，即使来源位于上方', () => {
    expect(
      resolveEdgeHandlesForLayout(
        { x: 220, y: 40 },
        { x: 260, y: 220 },
        {
          id: 'template:quiz-1',
          type: 'resizable',
          position: { x: 0, y: 0 },
          data: { label: '测验 1', resourceKind: 'template', templateType: 'quiz' },
        } as any,
        {
          id: 'kbdoc:doc-1',
          type: 'resizable',
          position: { x: 0, y: 0 },
          data: { label: '文档 1', resourceKind: 'kbdoc' },
        } as any,
        {
          sameKindConnectionCount: 0,
          differentKindConnectionCount: 1,
          relatedKindCounts: { kbdoc: 1 },
        },
        {
          sameKindConnectionCount: 0,
          differentKindConnectionCount: 5,
          relatedKindCounts: { quiz: 4, mindmap: 1 },
        },
      )
    ).toEqual({
      sourceHandle: 'b-s',
      targetHandle: 'l-t',
    });
  });

  it('非主连接类型会按几何方向接入，不会被强制占用左右连接点', () => {
    expect(
      resolveEdgeHandlesForLayout(
        { x: 260, y: 40 },
        { x: 260, y: 220 },
        {
          id: 'template:mind-1',
          type: 'resizable',
          position: { x: 0, y: 0 },
          data: { label: '导图 1', resourceKind: 'template', templateType: 'mindmap' },
        } as any,
        {
          id: 'kbdoc:doc-1',
          type: 'resizable',
          position: { x: 0, y: 0 },
          data: { label: '文档 1', resourceKind: 'kbdoc' },
        } as any,
        {
          sameKindConnectionCount: 0,
          differentKindConnectionCount: 1,
          relatedKindCounts: { kbdoc: 1 },
        },
        {
          sameKindConnectionCount: 0,
          differentKindConnectionCount: 5,
          relatedKindCounts: { quiz: 4, mindmap: 1 },
        },
      )
    ).toEqual({
      sourceHandle: 'b-s',
      targetHandle: 't-t',
    });
  });

  it('异类连接数达到 4 时，同类边会允许跟随横向主方向', () => {
    expect(
      resolveEdgeHandlesForLayout(
        { x: 100, y: 100 },
        { x: 320, y: 180 },
        {
          id: 'kbdoc:doc-1',
          type: 'resizable',
          position: { x: 0, y: 0 },
          data: { label: '文档 1', resourceKind: 'kbdoc' },
        } as any,
        {
          id: 'kbdoc:doc-2',
          type: 'resizable',
          position: { x: 0, y: 0 },
          data: { label: '文档 2', resourceKind: 'kbdoc' },
        } as any,
        {
          sameKindConnectionCount: 1,
          differentKindConnectionCount: 4,
        },
        {
          sameKindConnectionCount: 1,
          differentKindConnectionCount: 0,
        },
      )
    ).toEqual({
      sourceHandle: 'r-s',
      targetHandle: 'l-t',
    });
  });

  it('异类连接数不足 4 时，同类边仍优先使用上下连接点', () => {
    expect(
      resolveEdgeHandlesForLayout(
        { x: 100, y: 100 },
        { x: 320, y: 180 },
        {
          id: 'kbdoc:doc-1',
          type: 'resizable',
          position: { x: 0, y: 0 },
          data: { label: '文档 1', resourceKind: 'kbdoc' },
        } as any,
        {
          id: 'kbdoc:doc-2',
          type: 'resizable',
          position: { x: 0, y: 0 },
          data: { label: '文档 2', resourceKind: 'kbdoc' },
        } as any,
        {
          sameKindConnectionCount: 1,
          differentKindConnectionCount: 3,
        },
        {
          sameKindConnectionCount: 1,
          differentKindConnectionCount: 0,
        },
      )
    ).toEqual({
      sourceHandle: 'b-s',
      targetHandle: 't-t',
    });
  });

  it('注释节点不会参与横向中心统计', () => {
    expect(
      resolveEdgeHandlesForLayout(
        { x: 100, y: 100 },
        { x: 320, y: 180 },
        {
          id: 'kbdoc:doc-1',
          type: 'resizable',
          position: { x: 0, y: 0 },
          data: { label: '文档 1', resourceKind: 'kbdoc' },
        } as any,
        {
          id: 'kbdoc:doc-2',
          type: 'resizable',
          position: { x: 0, y: 0 },
          data: { label: '文档 2', resourceKind: 'kbdoc' },
        } as any,
        {
          sameKindConnectionCount: 0,
          differentKindConnectionCount: 0,
        },
        {
          sameKindConnectionCount: 0,
          differentKindConnectionCount: 0,
        },
      )
    ).toEqual({
      sourceHandle: 'b-s',
      targetHandle: 't-t',
    });
  });
});

describe('createGraphStore', () => {
  it('会为每个白板实例创建彼此隔离的状态容器', () => {
    const firstStore = createGraphStore();
    const secondStore = createGraphStore();

    firstStore.getState().addNode({
      id: 'node-1',
      type: 'resizable',
      position: { x: 0, y: 0 },
      data: {
        label: '节点 1',
      },
    });
    firstStore.getState().setSelectedTags(['核心']);

    expect(firstStore.getState().nodes).toHaveLength(1);
    expect(secondStore.getState().nodes).toHaveLength(0);
    expect(firstStore.getState().selectedTags).toEqual(['核心']);
    expect(secondStore.getState().selectedTags).toEqual([]);
  });

  it('复制节点会创建位置独立但同源数据同步的节点', () => {
    const store = createGraphStore();
    store.getState().setNodes([
      {
        id: 'node-1',
        type: 'resizable',
        position: { x: 100, y: 120 },
        data: {
          label: '节点 1',
          tags: ['核心'],
        },
      },
    ]);

    const duplicatedNodes = store.getState().duplicateNodes(['node-1']);
    const duplicatedNode = duplicatedNodes[0];

    expect(duplicatedNode.id).not.toBe('node-1');
    expect(duplicatedNode.position).toEqual({ x: 140, y: 160 });
    expect(duplicatedNode.data.sourceNodeId).toBe('node-1');

    store.getState().updateNodeData(duplicatedNode.id, { label: '同步名称' });

    expect(store.getState().nodes.map((node) => node.data.label)).toEqual([
      '同步名称',
      '同步名称',
    ]);
    expect(store.getState().nodes.map((node) => node.position)).toEqual([
      { x: 100, y: 120 },
      { x: 140, y: 160 },
    ]);
  });

  it('自动布局会把相同主标签节点靠近，并在不同标签之间保留分组间隙', () => {
    const store = createGraphStore();
    store.getState().setNodes([
      {
        id: 'core-1',
        type: 'resizable',
        position: { x: 0, y: 0 },
        data: { label: '核心 1', tags: ['核心'] },
      },
      {
        id: 'market-1',
        type: 'resizable',
        position: { x: 0, y: 0 },
        data: { label: '市场 1', tags: ['市场'] },
      },
      {
        id: 'core-2',
        type: 'resizable',
        position: { x: 0, y: 0 },
        data: { label: '核心 2', tags: ['核心'] },
      },
    ]);

    store.getState().optimizeLayout();

    const nextNodes = store.getState().nodes;
    const coreOneY = nextNodes.find((node) => node.id === 'core-1')?.position.y;
    const coreTwoY = nextNodes.find((node) => node.id === 'core-2')?.position.y;
    const marketY = nextNodes.find((node) => node.id === 'market-1')?.position.y;

    expect(coreOneY).toBeDefined();
    expect(coreTwoY).toBeDefined();
    expect(marketY).toBeDefined();
    const sameTagGap = Math.abs(coreTwoY! - coreOneY!);

    expect(sameTagGap).toBeGreaterThanOrEqual(82);
    expect(new Set([coreOneY, coreTwoY, marketY]).size).toBe(3);
  });

  it('自动布局会为两个节点之间的双向边写入同向偏移量以分离两侧曲线', () => {
    const nextGraph = optimizeGraphLayout({
      nodes: [
        {
          id: 'node-a',
          type: 'resizable',
          position: { x: 0, y: 0 },
          data: { label: '节点 A' },
        },
        {
          id: 'node-b',
          type: 'resizable',
          position: { x: 300, y: 0 },
          data: { label: '节点 B' },
        },
      ],
      edges: [
        { id: 'edge-a-b', source: 'node-a', target: 'node-b' },
        { id: 'edge-b-a', source: 'node-b', target: 'node-a' },
      ],
    });

    const forwardEdge = nextGraph.edges.find((edge) => edge.id === 'edge-a-b');
    const reverseEdge = nextGraph.edges.find((edge) => edge.id === 'edge-b-a');

    expect(forwardEdge?.data?.parallelEdgeOffset).toBeDefined();
    expect(reverseEdge?.data?.parallelEdgeOffset).toBeDefined();
    expect(forwardEdge?.data?.parallelEdgeOffset).toBe(reverseEdge?.data?.parallelEdgeOffset);
    expect(Math.abs(forwardEdge?.data?.parallelEdgeOffset ?? 0)).toBe(40);
  });

  it('自动布局会保留注释节点原始位置且不参与主干布局竞争', () => {
    const nextGraph = optimizeGraphLayout({
      nodes: [
        {
          id: 'node-a',
          type: 'resizable',
          position: { x: 0, y: 0 },
          data: { label: '节点 A', tags: ['主链'] },
        },
        {
          id: 'node-b',
          type: 'resizable',
          position: { x: 280, y: 0 },
          data: { label: '节点 B', tags: ['主链'] },
        },
        {
          id: 'note-a',
          type: 'annotation',
          position: { x: -120, y: 120 },
          data: { label: '注释 A', tags: ['注释'] },
        },
      ],
      edges: [
        { id: 'edge-a-b', source: 'node-a', target: 'node-b' },
        { id: 'edge-note-a', source: 'note-a', target: 'node-a' },
      ],
    });

    const nodeA = nextGraph.nodes.find((node) => node.id === 'node-a');
    const nodeB = nextGraph.nodes.find((node) => node.id === 'node-b');
    const noteA = nextGraph.nodes.find((node) => node.id === 'note-a');

    expect(nodeA).toBeDefined();
    expect(nodeB).toBeDefined();
    expect(noteA).toBeDefined();
    expect(nodeB!.position.x).toBeGreaterThan(nodeA!.position.x);
    expect(noteA!.position).toEqual({ x: -120, y: 120 });
  });

  it('自动布局会让文档 cluster 节点承担组内中心列', () => {
    const nextGraph = optimizeGraphLayout({
      nodes: [
        {
          id: 'doc-1',
          type: 'resizable',
          position: { x: 0, y: 0 },
          measured: { width: 220, height: 90 },
          data: {
            label: '文档 1',
            resourceKind: 'kbdoc',
            layoutClusterId: 'doc:1',
            layoutRole: 'cluster',
            layoutOrder: 0,
          },
        },
        {
          id: 'mindmap-1',
          type: 'resizable',
          position: { x: 0, y: 0 },
          measured: { width: 180, height: 70 },
          data: {
            label: '导图 1',
            resourceKind: 'template',
            templateType: 'mindmap',
            layoutClusterId: 'doc:1',
            layoutRole: 'member',
            layoutOrder: 1,
          },
        },
        {
          id: 'quiz-1',
          type: 'resizable',
          position: { x: 0, y: 0 },
          measured: { width: 160, height: 60 },
          data: {
            label: '测验 1',
            resourceKind: 'template',
            templateType: 'quiz',
            layoutClusterId: 'doc:1',
            layoutRole: 'member',
            layoutOrder: 2,
          },
        },
        {
          id: 'mindmap-2',
          type: 'resizable',
          position: { x: 0, y: 0 },
          measured: { width: 180, height: 70 },
          data: {
            label: '导图 2',
            resourceKind: 'template',
            templateType: 'mindmap',
            layoutClusterId: 'doc:1',
            layoutRole: 'member',
            layoutOrder: 3,
          },
        },
      ],
      edges: [
        { id: 'doc-mindmap-1', source: 'doc-1', target: 'mindmap-1', label: '来源' },
        { id: 'doc-mindmap-2', source: 'doc-1', target: 'mindmap-2', label: '来源' },
        { id: 'mindmap-1-quiz-1', source: 'mindmap-1', target: 'quiz-1', label: '对应' },
      ],
    });

    const docNode = nextGraph.nodes.find((node) => node.id === 'doc-1');
    const contentNodes = nextGraph.nodes.filter((node) => node.id !== 'doc-1');

    expect(docNode).toBeDefined();
    expect(contentNodes).toHaveLength(3);

    const contentTop = Math.min(...contentNodes.map((node) => node.position.y));
    const contentBottom = Math.max(...contentNodes.map((node) => node.position.y + (node.measured?.height ?? 0)));
    const contentCenterY = (contentTop + contentBottom) / 2;
    const docCenterY = docNode!.position.y + (docNode!.measured?.height ?? 0) / 2;

    expect(docNode!.position.x).toBeLessThan(Math.min(...contentNodes.map((node) => node.position.x)));
    expect(Math.abs(docCenterY - contentCenterY)).toBeLessThanOrEqual(1);
  });

  it('自动布局会在高扇出场景下放大纵向间距', () => {
    const nextGraph = optimizeGraphLayout({
      nodes: [
        {
          id: 'hub',
          type: 'resizable',
          position: { x: 0, y: 0 },
          data: { label: '中心节点' },
        },
        ...Array.from({ length: 6 }, (_, index) => ({
          id: `leaf-${index}`,
          type: 'resizable' as const,
          position: { x: 0, y: 0 },
          data: { label: `子节点 ${index}` },
        })),
      ],
      edges: Array.from({ length: 6 }, (_, index) => ({
        id: `edge-${index}`,
        source: 'hub',
        target: `leaf-${index}`,
      })),
    });

    const leafPositions = nextGraph.nodes
      .filter((node) => node.id.startsWith('leaf-'))
      .map((node) => node.position.y)
      .sort((first, second) => first - second);

    expect(leafPositions).toHaveLength(6);
    expect(leafPositions[5] - leafPositions[0]).toBeGreaterThan(600);
  });

  it('自动布局会按文档中心语义聚合同文档模板，并保留跨文档分层', () => {
    const nextGraph = optimizeGraphLayout({
      nodes: [
        {
          id: 'kbdoc:doc-1',
          type: 'resizable',
          position: { x: 0, y: 0 },
          data: { label: '文档 1', layoutClusterId: 'doc:doc-1', layoutRole: 'cluster', layoutOrder: 0 },
        },
        {
          id: 'template:mind-1',
          type: 'resizable',
          position: { x: 0, y: 0 },
          data: { label: '导图 1', layoutClusterId: 'doc:doc-1', layoutRole: 'member', layoutGroupId: 'topic-a', layoutOrder: 1 },
        },
        {
          id: 'template:quiz-1',
          type: 'resizable',
          position: { x: 0, y: 0 },
          data: { label: '测验 1', layoutClusterId: 'doc:doc-1', layoutRole: 'member', layoutGroupId: 'topic-a', layoutOrder: 2 },
        },
        {
          id: 'kbdoc:doc-2',
          type: 'resizable',
          position: { x: 0, y: 0 },
          data: { label: '文档 2', layoutClusterId: 'doc:doc-2', layoutRole: 'cluster', layoutOrder: 0 },
        },
        {
          id: 'template:mind-2',
          type: 'resizable',
          position: { x: 0, y: 0 },
          data: { label: '导图 2', layoutClusterId: 'doc:doc-2', layoutRole: 'member', layoutGroupId: 'topic-b', layoutOrder: 1 },
        },
      ],
      edges: [
        {
          id: 'edge-doc-1',
          source: 'kbdoc:doc-1',
          target: 'template:mind-1',
          data: { layoutScope: 'intra-cluster', relationWeight: 4 },
        },
        {
          id: 'edge-topic-1',
          source: 'template:mind-1',
          target: 'template:quiz-1',
          data: { layoutScope: 'intra-cluster', relationWeight: 5 },
        },
        {
          id: 'edge-doc-2',
          source: 'kbdoc:doc-2',
          target: 'template:mind-2',
          data: { layoutScope: 'intra-cluster', relationWeight: 4 },
        },
        {
          id: 'edge-cross-doc',
          source: 'template:mind-1',
          target: 'template:mind-2',
          data: { layoutScope: 'inter-cluster', relationWeight: 2 },
        },
      ],
    });

    const docOne = nextGraph.nodes.find((node) => node.id === 'kbdoc:doc-1');
    const mindOne = nextGraph.nodes.find((node) => node.id === 'template:mind-1');
    const quizOne = nextGraph.nodes.find((node) => node.id === 'template:quiz-1');
    const docTwo = nextGraph.nodes.find((node) => node.id === 'kbdoc:doc-2');
    const mindTwo = nextGraph.nodes.find((node) => node.id === 'template:mind-2');

    expect(docOne).toBeDefined();
    expect(mindOne).toBeDefined();
    expect(quizOne).toBeDefined();
    expect(docTwo).toBeDefined();
    expect(mindTwo).toBeDefined();
    expect(mindOne!.position.x).toBeGreaterThan(docOne!.position.x);
    expect(quizOne!.position.x).toBeGreaterThan(docOne!.position.x);
    expect(Math.abs(quizOne!.position.x - mindOne!.position.x)).toBeLessThanOrEqual(1);
    expect(quizOne!.position.y).toBeGreaterThan(mindOne!.position.y);
    expect(docTwo!.position.x).toBeGreaterThan(docOne!.position.x);
    expect(mindTwo!.position.x).toBeGreaterThan(docTwo!.position.x);
  });

  it('自动布局会按连接方向语义让 member 分列并整体上下错位', () => {
    const nextGraph = optimizeGraphLayout({
      nodes: [
        {
          id: 'kbdoc:doc-1',
          type: 'resizable',
          position: { x: 0, y: 0 },
          measured: { width: 220, height: 90 },
          data: { label: '文档 1', resourceKind: 'kbdoc', layoutClusterId: 'doc:doc-1', layoutRole: 'cluster', layoutOrder: 0 },
        },
        {
          id: 'template:mind-1',
          type: 'resizable',
          position: { x: 0, y: 0 },
          measured: { width: 180, height: 70 },
          data: { label: '导图 1', resourceKind: 'template', templateType: 'mindmap', layoutClusterId: 'doc:doc-1', layoutRole: 'member', layoutOrder: 1 },
        },
        {
          id: 'template:mind-2',
          type: 'resizable',
          position: { x: 0, y: 0 },
          measured: { width: 180, height: 70 },
          data: { label: '导图 2', resourceKind: 'template', templateType: 'mindmap', layoutClusterId: 'doc:doc-1', layoutRole: 'member', layoutOrder: 2 },
        },
        {
          id: 'template:quiz-1',
          type: 'resizable',
          position: { x: 0, y: 0 },
          measured: { width: 160, height: 60 },
          data: { label: '测验 1', resourceKind: 'template', templateType: 'quiz', layoutClusterId: 'doc:doc-1', layoutRole: 'member', layoutOrder: 3 },
        },
        {
          id: 'template:quiz-2',
          type: 'resizable',
          position: { x: 0, y: 0 },
          measured: { width: 160, height: 60 },
          data: { label: '测验 2', resourceKind: 'template', templateType: 'quiz', layoutClusterId: 'doc:doc-1', layoutRole: 'member', layoutOrder: 4 },
        },
      ],
      edges: [
        { id: 'edge-doc-mind-1', source: 'kbdoc:doc-1', target: 'template:mind-1' },
        { id: 'edge-doc-mind-2', source: 'kbdoc:doc-1', target: 'template:mind-2' },
        { id: 'edge-doc-quiz-1', source: 'kbdoc:doc-1', target: 'template:quiz-1' },
        { id: 'edge-doc-quiz-2', source: 'kbdoc:doc-1', target: 'template:quiz-2' },
      ],
    });

    const docNode = nextGraph.nodes.find((node) => node.id === 'kbdoc:doc-1');
    const mindOne = nextGraph.nodes.find((node) => node.id === 'template:mind-1');
    const mindTwo = nextGraph.nodes.find((node) => node.id === 'template:mind-2');
    const quizOne = nextGraph.nodes.find((node) => node.id === 'template:quiz-1');
    const quizTwo = nextGraph.nodes.find((node) => node.id === 'template:quiz-2');

    expect(docNode).toBeDefined();
    expect(mindOne).toBeDefined();
    expect(mindTwo).toBeDefined();
    expect(quizOne).toBeDefined();
    expect(quizTwo).toBeDefined();
    expect(mindOne!.position.x).toBeGreaterThan(docNode!.position.x);
    expect(quizOne!.position.x).toBeGreaterThan(docNode!.position.x);
    expect(Math.abs(mindOne!.position.x - mindTwo!.position.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(quizOne!.position.x - quizTwo!.position.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(mindOne!.position.x - quizOne!.position.x)).toBeGreaterThan(100);
    expect(mindOne!.position.y).toBeLessThan(docNode!.position.y);
    expect(mindTwo!.position.y).toBeLessThan(docNode!.position.y);
    expect(quizOne!.position.y).toBeGreaterThan(mindOne!.position.y);
    expect(quizTwo!.position.y).toBeGreaterThan(mindTwo!.position.y);
  });
});
