// merge 负责把持久化画布快照与资源中心轻量全集合并为可渲染图数据。
import type { Edge } from '@xyflow/react';
import type { AppNode, AppNodeData } from '../../../graph';
import type {
  FlowCanvasSnapshot,
  FlowCanvasResourceDoc,
  FlowCanvasResourceCatalog,
  FlowCanvasResourceTemplate,
} from '../types';

const DEFAULT_SNAPSHOT_VERSION = 1;
const DOC_NODE_X = 80;
const TEMPLATE_NODE_X = 520;
const NODE_START_Y = 80;
const NODE_GAP_Y = 120;
const NORMALIZED_NODE_X = 80;
const NORMALIZED_NODE_COLUMNS = 4;
const NORMALIZED_NODE_COLUMN_GAP = 220;

const createEmptySnapshot = (): FlowCanvasSnapshot => ({
  version: DEFAULT_SNAPSHOT_VERSION,
  nodes: [],
  edges: [],
});

export const parseFlowCanvasSnapshot = (canvas?: Record<string, unknown>): FlowCanvasSnapshot => {
  if (!canvas || Object.keys(canvas).length === 0) {
    return createEmptySnapshot();
  }
  if (!Array.isArray(canvas.nodes) || !Array.isArray(canvas.edges)) {
    return createEmptySnapshot();
  }
  const normalizedNodes = canvas.nodes
    .map((node, index) => normalizeSnapshotNode(node, index))
    .filter((node): node is AppNode => Boolean(node));
  const validNodeIds = new Set(normalizedNodes.map((node) => node.id));
  const normalizedEdges = canvas.edges
    .map((edge, index) => normalizeSnapshotEdge(edge, index, validNodeIds))
    .filter((edge): edge is Edge => Boolean(edge));
  return {
    version: typeof canvas.version === 'number' ? canvas.version : DEFAULT_SNAPSHOT_VERSION,
    nodes: normalizedNodes,
    edges: normalizedEdges,
    viewport: typeof canvas.viewport === 'object' && canvas.viewport !== null
      ? canvas.viewport as FlowCanvasSnapshot['viewport']
      : undefined,
  };
};

const normalizeSnapshotNode = (rawNode: unknown, index: number): AppNode | null => {
  if (!isRecord(rawNode)) {
    return null;
  }
  const id = typeof rawNode.id === 'string' ? rawNode.id.trim() : '';
  if (!id) {
    return null;
  }
  const data = isRecord(rawNode.data) ? rawNode.data : {};
  const label = resolveNodeLabel(rawNode, data, id);
  const nodeType = rawNode.type === 'annotation' ? 'annotation' : 'resizable';

  return {
    ...rawNode,
    id,
    type: nodeType,
    position: resolveNodePosition(rawNode, index),
    data: {
      ...data,
      label,
    } as AppNodeData,
  } as AppNode;
};

const normalizeSnapshotEdge = (
  rawEdge: unknown,
  index: number,
  validNodeIds: Set<string>
): Edge | null => {
  if (!isRecord(rawEdge)) {
    return null;
  }
  const source = typeof rawEdge.source === 'string' ? rawEdge.source.trim() : '';
  const target = typeof rawEdge.target === 'string' ? rawEdge.target.trim() : '';
  if (!source || !target || !validNodeIds.has(source) || !validNodeIds.has(target)) {
    return null;
  }
  const edgeId = typeof rawEdge.id === 'string' && rawEdge.id.trim()
    ? rawEdge.id.trim()
    : `edge:${source}:${target}:${index}`;

  return {
    ...rawEdge,
    id: edgeId,
    source,
    target,
  } as Edge;
};

const resolveNodeLabel = (
  rawNode: Record<string, unknown>,
  data: Record<string, unknown>,
  nodeId: string
): string => {
  if (typeof data.label === 'string' && data.label.trim()) {
    return data.label.trim();
  }
  if (typeof rawNode.label === 'string' && rawNode.label.trim()) {
    return rawNode.label.trim();
  }
  return nodeId;
};

const resolveNodePosition = (rawNode: Record<string, unknown>, index: number) => {
  if (hasValidNodePosition(rawNode)) {
    return rawNode.position as AppNode['position'];
  }
  const column = index % NORMALIZED_NODE_COLUMNS;
  const row = Math.floor(index / NORMALIZED_NODE_COLUMNS);
  return {
    x: NORMALIZED_NODE_X + column * NORMALIZED_NODE_COLUMN_GAP,
    y: NODE_START_Y + row * NODE_GAP_Y,
  };
};

const hasValidNodePosition = (rawNode: unknown): boolean => {
  if (!isRecord(rawNode) || !isRecord(rawNode.position)) {
    return false;
  }
  return isFiniteNumber(rawNode.position.x) && isFiniteNumber(rawNode.position.y);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const docNodeId = (docId: string) => `kbdoc:${docId}`;

const templateNodeId = (templateId: string) => `template:${templateId}`;

const resolveTemplatePluginId = (template: FlowCanvasResourceTemplate) => {
  const rawPluginId = typeof template.pluginId === 'string' ? template.pluginId.trim() : '';
  if (rawPluginId) {
    return rawPluginId;
  }
  return typeof template.type === 'string' ? template.type.trim() : '';
};

const derivedTemplateSourceEdgeId = (docId: string, templateId: string) =>
  `derived:kbdoc:${docId}:template:${templateId}`;

const isResourceNodeId = (nodeId: string) =>
  nodeId.startsWith('kbdoc:') || nodeId.startsWith('template:');

const resolveTemplateClusterId = (template: FlowCanvasResourceTemplate) =>
  template.source && template.source.length === 1
    ? `doc:${template.source[0]}`
    : `template:${template.templateId}`;

const buildDocNode = (doc: FlowCanvasResourceDoc, index: number): AppNode => ({
  id: docNodeId(doc.docId),
  type: 'resizable',
  position: {
    x: DOC_NODE_X,
    y: NODE_START_Y + index * NODE_GAP_Y,
  },
  data: {
    label: doc.name,
    tags: ['文档', doc.status ?? 'UNKNOWN'],
    description: doc.status ? `文档状态：${doc.status}` : undefined,
    resourceKind: 'kbdoc',
    refId: doc.docId,
    refKind: 'kbdoc',
    layoutClusterId: `doc:${doc.docId}`,
    layoutRole: 'cluster',
    layoutOrder: 0,
  },
});

const buildTemplateNode = (
  template: FlowCanvasResourceTemplate,
  index: number,
  docNameMap: Map<string, string>
) => {
  const pluginId = resolveTemplatePluginId(template);

  return {
    id: templateNodeId(template.templateId),
    type: 'resizable',
    position: {
      x: TEMPLATE_NODE_X,
      y: NODE_START_Y + index * NODE_GAP_Y,
    },
    data: {
      label: template.name,
      tags: ['模板', pluginId || 'unknown'],
      description: buildTemplateDescription(template, docNameMap),
      resourceKind: 'template',
      refId: template.templateId,
      refKind: 'template',
      pluginId: pluginId || undefined,
      templateType: pluginId || undefined,
      sourceDocIds: template.source,
      layoutClusterId: resolveTemplateClusterId(template),
      layoutRole: 'member',
      layoutGroupId: resolveTemplateLayoutGroupId(template),
      layoutOrder: index + 1,
    } as AppNode['data'],
  } as AppNode;
};

const mergeNodeData = (node: AppNode, nextData: AppNode['data']): AppNode => ({
  ...node,
  data: {
    ...node.data,
    ...nextData,
  },
});

const stripLayoutHints = (data: AppNode['data']): AppNode['data'] => {
  const rest = { ...data };
  delete rest.layoutClusterId;
  delete rest.layoutRole;
  delete rest.layoutGroupId;
  delete rest.layoutOrder;
  return rest;
};

const getNodeSourceId = (node: AppNode) => node.data.sourceNodeId ?? node.id;

const resolveTemplateLayoutGroupId = (template: FlowCanvasResourceTemplate) => {
  return template.templateId;
};

const TEMPLATE_SOURCE_PREVIEW_LIMIT = 3;

const buildTemplateSourceSummary = (
  template: FlowCanvasResourceTemplate,
  docNameMap: Map<string, string>
) => {
  const sourceIds = (template.source ?? []).map((docId) => docId.trim()).filter(Boolean);

  if (sourceIds.length === 0) {
    return null;
  }

  const sourceNames = sourceIds.map((docId) => docNameMap.get(docId) ?? docId);
  const visibleSourceNames = sourceNames.slice(0, TEMPLATE_SOURCE_PREVIEW_LIMIT);
  const suffix = sourceNames.length > TEMPLATE_SOURCE_PREVIEW_LIMIT
    ? ` 等 ${sourceNames.length} 篇`
    : '';

  return `参考文档：${visibleSourceNames.join('、')}${suffix}`;
};

const buildTemplateDescription = (
  template: FlowCanvasResourceTemplate,
  docNameMap: Map<string, string>
) => {
  const sections = [
    buildTemplateSourceSummary(template, docNameMap),
  ].filter((item): item is string => Boolean(item));

  return sections.length > 0 ? sections.join('，') : undefined;
};

const createDocNameMap = (resourceCatalog: FlowCanvasResourceCatalog) => new Map(
  resourceCatalog.docs.map((doc) => [doc.docId, doc.name] as const)
);

const buildDerivedTemplateSourceEdges = (
  resourceCatalog: FlowCanvasResourceCatalog,
  validNodeIds: Set<string>,
  existingEdges: Edge[]
) => {
  const existingResourceEdgeKeys = new Set(
    existingEdges.map((edge) => `${edge.source}=>${edge.target}`)
  );

  return resourceCatalog.templates.flatMap((template) => {
    const target = templateNodeId(template.templateId);
    if (!validNodeIds.has(target)) {
      return [];
    }

    return (template.source ?? [])
      .map((docId) => docId.trim())
      .filter(Boolean)
      .flatMap((docId) => {
        const source = docNodeId(docId);
        const edgeKey = `${source}=>${target}`;

        if (!validNodeIds.has(source) || existingResourceEdgeKeys.has(edgeKey)) {
          return [];
        }

        existingResourceEdgeKeys.add(edgeKey);

        return [{
          id: derivedTemplateSourceEdgeId(docId, template.templateId),
          source,
          target,
          label: '来源',
          data: {
            derived: true,
          },
        } satisfies Edge];
      });
  });
};

export const mergeCanvasWithResourceCatalog = (
  snapshot: FlowCanvasSnapshot,
  resourceCatalog: FlowCanvasResourceCatalog
): FlowCanvasSnapshot => {
  const docNameMap = createDocNameMap(resourceCatalog);
  const nodeById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const freshNodeById = new Map<string, AppNode>();
  const nextDataByNodeId = new Map<string, AppNode['data']>();
  const validNodeIds = new Set<string>();
  const nextNodes: AppNode[] = [];

  resourceCatalog.docs.forEach((doc, index) => {
    const id = docNodeId(doc.docId);
    validNodeIds.add(id);
    const existing = nodeById.get(id);
    const freshNode = buildDocNode(doc, index);
    freshNodeById.set(id, freshNode);
    const nextNode = existing ? mergeNodeData(existing, freshNode.data) : freshNode;
    nextDataByNodeId.set(id, nextNode.data);
    nextNodes.push(nextNode);
  });

  resourceCatalog.templates.forEach((template, index) => {
    const id = templateNodeId(template.templateId);
    validNodeIds.add(id);
    const existing = nodeById.get(id);
    const freshNode = buildTemplateNode(template, index, docNameMap);
    freshNodeById.set(id, freshNode);
    const nextNode = existing ? mergeNodeData(existing, freshNode.data) : freshNode;
    nextDataByNodeId.set(id, nextNode.data);
    nextNodes.push(nextNode);
  });

  snapshot.nodes
    .filter((node) => !validNodeIds.has(node.id))
    .forEach((node) => {
      const sourceNodeId = getNodeSourceId(node);
      const freshSourceNode = freshNodeById.get(sourceNodeId);
      const snapshotSourceNode = nodeById.get(sourceNodeId);
      const sourceData = nextDataByNodeId.get(sourceNodeId) ?? snapshotSourceNode?.data;

      if (!node.data.sourceNodeId && isResourceNodeId(node.id) && !freshNodeById.has(node.id)) {
        return;
      }

      if (node.data.sourceNodeId && isResourceNodeId(sourceNodeId) && !freshSourceNode) {
        return;
      }

      validNodeIds.add(node.id);
      const mergedSourceData = node.data.sourceNodeId && isResourceNodeId(sourceNodeId) && sourceData
        ? stripLayoutHints(sourceData)
        : sourceData;
      nextNodes.push(mergedSourceData ? mergeNodeData(node, mergedSourceData) : node);
  });

  const nextEdges = snapshot.edges.filter((edge) =>
    validNodeIds.has(edge.source) && validNodeIds.has(edge.target)
  );
  const derivedEdges = buildDerivedTemplateSourceEdges(resourceCatalog, validNodeIds, nextEdges);

  return {
    version: snapshot.version || DEFAULT_SNAPSHOT_VERSION,
    nodes: nextNodes,
    edges: [...nextEdges, ...derivedEdges],
    viewport: snapshot.viewport,
  };
};

export const mergeCanvasWithResourceOptions = mergeCanvasWithResourceCatalog;
