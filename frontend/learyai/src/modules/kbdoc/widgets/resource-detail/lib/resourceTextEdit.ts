// resourceTextEdit 负责资源详情页文本就地编辑的锚点定义与目录树 patch。
import type { DocumentationNode, DocumentationTree } from '../../../entities/resource';

export type ResourceTextEditAnchor =
  | { kind: 'name' }
  | { kind: 'description' }
  | { kind: 'directory'; nodeId: string; field: 'title' | 'summary' };

export const patchDocumentationTreeNode = (
  nodes: DocumentationNode[],
  nodeId: string,
  field: 'title' | 'summary',
  value: string,
): DocumentationNode[] => nodes.map((node) => {
  if (node.id === nodeId) {
    return {
      ...node,
      [field]: value,
    };
  }
  if (node.children.length === 0) {
    return node;
  }
  return {
    ...node,
    children: patchDocumentationTreeNode(node.children, nodeId, field, value),
  };
});

export const patchDocumentationTree = (
  tree: DocumentationTree,
  anchor: Extract<ResourceTextEditAnchor, { kind: 'directory' }>,
  value: string,
): DocumentationTree => ({
  ...tree,
  nodes: patchDocumentationTreeNode(tree.nodes, anchor.nodeId, anchor.field, value),
});
