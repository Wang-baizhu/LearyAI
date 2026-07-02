// merge.test.ts 负责验证持久化画布快照与真实资源全集的合并规则。
import { describe, expect, it } from 'vitest';
import { mergeCanvasWithResourceOptions, parseFlowCanvasSnapshot } from '../effects/merge';
import type { FlowCanvasResourceCatalog, FlowCanvasSnapshot } from '../types';

describe('parseFlowCanvasSnapshot', () => {
  it('会把空 canvas 解析为空白快照', () => {
    expect(parseFlowCanvasSnapshot()).toEqual({
      version: 1,
      nodes: [],
      edges: [],
    });
  });

  it('会把缺失 nodes 或 edges 的脏数据降级为空白快照', () => {
    expect(parseFlowCanvasSnapshot({ version: 1 })).toEqual({
      version: 1,
      nodes: [],
      edges: [],
    });
  });

  it('会在节点缺少 position 时自动补默认位置', () => {
    const snapshot = parseFlowCanvasSnapshot({
      version: 1,
      nodes: [
        {
          id: 'node-1',
          type: 'document',
          label: '节点一',
          data: {},
        },
        {
          id: 'node-2',
          type: 'question_type',
          data: { label: '节点二' },
        },
      ],
      edges: [
        {
          source: 'node-1',
          target: 'node-2',
          label: '关联',
        },
      ],
    });

    expect(snapshot.nodes).toHaveLength(2);
    expect(snapshot.nodes[0]?.type).toBe('resizable');
    expect(snapshot.nodes[0]?.data.label).toBe('节点一');
    expect(snapshot.nodes[0]?.position).toEqual(
      expect.objectContaining({
        x: expect.any(Number),
        y: expect.any(Number),
      })
    );
    expect(snapshot.nodes[1]?.position).toEqual(
      expect.objectContaining({
        x: expect.any(Number),
        y: expect.any(Number),
      })
    );
    expect(snapshot.edges[0]?.id).toBe('edge:node-1:node-2:0');
  });

  it('只补缺失 position 的节点，不覆盖已有节点位置', () => {
    const snapshot = parseFlowCanvasSnapshot({
      version: 1,
      nodes: [
        {
          id: 'node-fixed',
          type: 'resizable',
          position: { x: 420, y: 240 },
          data: { label: '固定节点' },
        },
        {
          id: 'node-missing',
          type: 'resizable',
          data: { label: '补位节点' },
        },
      ],
      edges: [
        {
          id: 'edge-fixed-missing',
          source: 'node-fixed',
          target: 'node-missing',
        },
      ],
    });

    expect(snapshot.nodes.find((node) => node.id === 'node-fixed')?.position).toEqual({ x: 420, y: 240 });
    expect(snapshot.nodes.find((node) => node.id === 'node-missing')?.position).toEqual({
      x: expect.any(Number),
      y: expect.any(Number),
    });
    expect(snapshot.edges[0]?.id).toBe('edge-fixed-missing');
  });
});

describe('mergeCanvasWithResourceOptions', () => {
  const options: FlowCanvasResourceCatalog = {
    docs: [
      { docId: 'doc-1', name: '文档 1', status: 'DONE' },
      { docId: 'doc-2', name: '文档 2', status: 'PENDING' },
    ],
    templates: [
      { templateId: 'template-1', name: '模板 1', type: 'mindmap', visibility: 'PRIVATE', source: ['doc-1'] },
    ],
  };

  it('会保留已有节点位置并用真实资源名称更新展示数据', () => {
    const snapshot: FlowCanvasSnapshot = {
      version: 1,
      nodes: [
        {
          id: 'kbdoc:doc-1',
          type: 'resizable',
          position: { x: 300, y: 400 },
          data: { label: '旧名称' },
        },
      ],
      edges: [],
    };

    const merged = mergeCanvasWithResourceOptions(snapshot, options);
    const docNode = merged.nodes.find((node) => node.id === 'kbdoc:doc-1');

    expect(docNode?.position).toEqual({ x: 300, y: 400 });
    expect(docNode?.data.label).toBe('文档 1');
    expect(docNode?.data.layoutRole).toBe('cluster');
    expect(merged.nodes.map((node) => node.id)).toContain('kbdoc:doc-2');
    expect(merged.nodes.map((node) => node.id)).toContain('template:template-1');
  });

  it('模板节点描述会优先使用资源目录里的文档名作为来源文案', () => {
    const merged = mergeCanvasWithResourceOptions({
      version: 1,
      nodes: [],
      edges: [],
    }, options);
    const templateNode = merged.nodes.find((node) => node.id === 'template:template-1');

    expect(templateNode?.data.description).toContain('参考文档：文档 1');
  });

  it('模板来源过多时会截断展示并保留总数', () => {
    const merged = mergeCanvasWithResourceOptions({
      version: 1,
      nodes: [],
      edges: [],
    }, {
      docs: [
        { docId: 'doc-a', name: '文档A' },
        { docId: 'doc-b', name: '文档B' },
        { docId: 'doc-c', name: '文档C' },
        { docId: 'doc-d', name: '文档D' },
      ],
      templates: [
        {
          templateId: 'template-many',
          name: '模板 Many',
          type: 'quiz',
          source: ['doc-a', 'doc-b', 'doc-c', 'doc-d'],
        },
      ],
    });
    const templateNode = merged.nodes.find((node) => node.id === 'template:template-many');

    expect(templateNode?.data.description).toContain('参考文档：文档A、文档B、文档C 等 4 篇');
  });

  it('会过滤已删除资源节点和失效边，并保留注释节点', () => {
    const snapshot: FlowCanvasSnapshot = {
      version: 1,
      nodes: [
        {
          id: 'kbdoc:deleted',
          type: 'resizable',
          position: { x: 0, y: 0 },
          data: { label: '已删除' },
        },
        {
          id: 'annotation:note',
          type: 'annotation',
          position: { x: 10, y: 10 },
          data: { label: '注释' },
        },
      ],
      edges: [
        { id: 'edge-invalid', source: 'kbdoc:deleted', target: 'kbdoc:doc-1' },
        { id: 'edge-valid', source: 'annotation:note', target: 'kbdoc:doc-1' },
      ],
    };

    const merged = mergeCanvasWithResourceOptions(snapshot, options);

    expect(merged.nodes.map((node) => node.id)).not.toContain('kbdoc:deleted');
    expect(merged.nodes.map((node) => node.id)).toContain('annotation:note');
    expect(merged.edges.map((edge) => edge.id)).toEqual([
      'edge-valid',
      'derived:kbdoc:doc-1:template:template-1',
    ]);
  });

  it('会保留复制资源节点的独立位置，并用源资源同步展示数据', () => {
    const snapshot: FlowCanvasSnapshot = {
      version: 1,
      nodes: [
        {
          id: 'kbdoc:doc-1',
          type: 'resizable',
          position: { x: 100, y: 100 },
          data: { label: '旧名称' },
        },
        {
          id: 'kbdoc:doc-1__copy_1',
          type: 'resizable',
          position: { x: 300, y: 320 },
          data: {
            label: '副本旧名称',
            sourceNodeId: 'kbdoc:doc-1',
          },
        },
      ],
      edges: [],
    };

    const merged = mergeCanvasWithResourceOptions(snapshot, options);
    const copiedNode = merged.nodes.find((node) => node.id === 'kbdoc:doc-1__copy_1');

    expect(copiedNode?.position).toEqual({ x: 300, y: 320 });
    expect(copiedNode?.data.label).toBe('文档 1');
    expect(copiedNode?.data.tags).toEqual(['文档', 'DONE']);
    expect(copiedNode?.data.sourceNodeId).toBe('kbdoc:doc-1');
  });

  it('复制的资源节点不会继承源节点的 cluster 布局 hint', () => {
    const snapshot: FlowCanvasSnapshot = {
      version: 1,
      nodes: [
        {
          id: 'template:template-1',
          type: 'resizable',
          position: { x: 100, y: 100 },
          data: {
            label: '旧模板名',
            layoutClusterId: 'doc:legacy',
            layoutRole: 'member',
            layoutGroupId: 'legacy-group',
            layoutOrder: 99,
          },
        },
        {
          id: 'template:template-1__copy_1',
          type: 'resizable',
          position: { x: 360, y: 320 },
          data: {
            label: '模板副本',
            sourceNodeId: 'template:template-1',
          },
        },
      ],
      edges: [],
    };

    const merged = mergeCanvasWithResourceOptions(snapshot, options);
    const copiedNode = merged.nodes.find((node) => node.id === 'template:template-1__copy_1');

    expect(copiedNode?.position).toEqual({ x: 360, y: 320 });
    expect(copiedNode?.data.label).toBe('模板 1');
    expect(copiedNode?.data.sourceNodeId).toBe('template:template-1');
    expect(copiedNode?.data.templateType).toBe('mindmap');
    expect(copiedNode?.data.sourceDocIds).toEqual(['doc-1']);
    expect(copiedNode?.data.layoutClusterId).toBeUndefined();
    expect(copiedNode?.data.layoutRole).toBeUndefined();
    expect(copiedNode?.data.layoutGroupId).toBeUndefined();
    expect(copiedNode?.data.layoutOrder).toBeUndefined();
  });

  it('会保留普通画布节点与普通节点副本，并同步副本展示数据', () => {
    const snapshot: FlowCanvasSnapshot = {
      version: 1,
      nodes: [
        {
          id: 'custom-node',
          type: 'resizable',
          position: { x: 40, y: 50 },
          data: { label: '普通节点', tags: ['未分类'] },
        },
        {
          id: 'custom-node__copy_1',
          type: 'resizable',
          position: { x: 160, y: 170 },
          data: {
            label: '旧副本',
            sourceNodeId: 'custom-node',
          },
        },
      ],
      edges: [
        { id: 'edge-custom-copy', source: 'custom-node', target: 'custom-node__copy_1' },
      ],
    };

    const merged = mergeCanvasWithResourceOptions(snapshot, options);
    const copiedNode = merged.nodes.find((node) => node.id === 'custom-node__copy_1');

    expect(merged.nodes.map((node) => node.id)).toContain('custom-node');
    expect(copiedNode?.position).toEqual({ x: 160, y: 170 });
    expect(copiedNode?.data.label).toBe('普通节点');
    expect(copiedNode?.data.sourceNodeId).toBe('custom-node');
    expect(merged.edges.map((edge) => edge.id)).toContain('edge-custom-copy');
  });

  it('会把模板 source 转成通用布局 hint，并为缺失的来源关系补派生边', () => {
    const merged = mergeCanvasWithResourceOptions({
      version: 1,
      nodes: [],
      edges: [],
    }, {
      docs: [{ docId: 'doc-1', name: '文档 1', status: 'DONE' }],
      templates: [
        { templateId: 'mind-1', name: '导图', type: 'mindmap', source: ['doc-1'] },
        { templateId: 'quiz-1', name: '测验', type: 'quiz', source: ['doc-1'] },
      ],
    });

    const mindmapNode = merged.nodes.find((node) => node.id === 'template:mind-1');
    const quizNode = merged.nodes.find((node) => node.id === 'template:quiz-1');

    expect(mindmapNode?.data.layoutClusterId).toBe('doc:doc-1');
    expect(mindmapNode?.data.layoutRole).toBe('member');
    expect(mindmapNode?.data.sourceDocIds).toEqual(['doc-1']);
    expect(quizNode?.data.layoutRole).toBe('member');
    expect(quizNode?.data.layoutGroupId).toBe('quiz-1');
    expect(merged.edges).toEqual([
      {
        id: 'derived:kbdoc:doc-1:template:mind-1',
        source: 'kbdoc:doc-1',
        target: 'template:mind-1',
        label: '来源',
        data: {
          derived: true,
        },
      },
      {
        id: 'derived:kbdoc:doc-1:template:quiz-1',
        source: 'kbdoc:doc-1',
        target: 'template:quiz-1',
        label: '来源',
        data: {
          derived: true,
        },
      },
    ]);
  });

  it('会保留多来源模板的原始来源数组但不挂到单一文档 cluster', () => {
    const merged = mergeCanvasWithResourceOptions({
      version: 1,
      nodes: [],
      edges: [],
    }, {
      docs: [
        { docId: 'doc-a', name: '文档 A', status: 'DONE' },
        { docId: 'doc-b', name: '文档 B', status: 'DONE' },
      ],
      templates: [
        {
          templateId: 'multi-source',
          name: '多来源模板',
          type: 'mindmap',
          source: ['doc-a', 'doc-b'],
        },
      ],
    });

    const templateNode = merged.nodes.find((node) => node.id === 'template:multi-source');

    expect(templateNode).toBeDefined();
    expect(templateNode?.data.sourceDocIds).toEqual(['doc-a', 'doc-b']);
    expect(templateNode?.data.layoutClusterId).toBe('template:multi-source');
    expect(templateNode?.data.layoutGroupId).toBe('multi-source');
    expect(merged.edges).toEqual([
      {
        id: 'derived:kbdoc:doc-a:template:multi-source',
        source: 'kbdoc:doc-a',
        target: 'template:multi-source',
        label: '来源',
        data: {
          derived: true,
        },
      },
      {
        id: 'derived:kbdoc:doc-b:template:multi-source',
        source: 'kbdoc:doc-b',
        target: 'template:multi-source',
        label: '来源',
        data: {
          derived: true,
        },
      },
    ]);
  });

  it('已有来源边时不会重复补派生边', () => {
    const merged = mergeCanvasWithResourceOptions({
      version: 1,
      nodes: [],
      edges: [
        {
          id: 'edge-existing',
          source: 'kbdoc:doc-1',
          target: 'template:template-1',
          label: '手动连线',
        },
      ],
    }, options);

    expect(merged.edges).toEqual([
      {
        id: 'edge-existing',
        source: 'kbdoc:doc-1',
        target: 'template:template-1',
        label: '手动连线',
      },
    ]);
  });
});
