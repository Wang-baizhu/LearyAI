// documentationTree 负责解析、过滤文档目录树并生成引用跳转载荷。
import type { DocumentationNode, DocumentationTree } from '../model/types';

export interface DocumentationCitationPayload {
  label: string;
  type: string;
  page: string;
  pageValue: string;
}

const normalizeFilterText = (value: string) => value.trim().toLocaleLowerCase();

const assertDocumentationNode = (value: unknown, path: string): DocumentationNode => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path} 必须是对象`);
  }
  const node = value as Partial<DocumentationNode>;
  if (typeof node.id !== 'string' || !node.id.trim()) {
    throw new Error(`${path}.id 必须是非空字符串`);
  }
  if (typeof node.title !== 'string' || !node.title.trim()) {
    throw new Error(`${path}.title 必须是非空字符串`);
  }
  if (typeof node.summary !== 'string' || !node.summary.trim()) {
    throw new Error(`${path}.summary 必须是非空字符串`);
  }
  if (!Number.isInteger(node.page_start) || !Number.isInteger(node.page_end)) {
    throw new Error(`${path}.page_start/page_end 必须是整数`);
  }
  const pageStart = node.page_start!;
  const pageEnd = node.page_end!;
  if (pageStart > pageEnd) {
    throw new Error(`${path}.page_start 不能大于 page_end`);
  }
  if (!Array.isArray(node.children)) {
    throw new Error(`${path}.children 必须是数组`);
  }
  return {
    id: node.id,
    title: node.title,
    summary: node.summary,
    page_start: pageStart,
    page_end: pageEnd,
    children: node.children.map((child, index) => assertDocumentationNode(child, `${path}.children[${index}]`)),
  };
};

export const parseDocumentationTree = (value: string | DocumentationTree): DocumentationTree => {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Array.isArray((parsed as DocumentationTree).nodes)) {
    throw new Error('documentation 必须是 JSON 树结构');
  }
  const tree = parsed as DocumentationTree;
  return {
    version: Number.isInteger(tree.version) ? tree.version : 1,
    nodes: tree.nodes.map((node, index) => assertDocumentationNode(node, `nodes[${index}]`)),
  };
};

export const collectExpandedNodeIds = (nodes: DocumentationNode[]): string[] =>
  nodes.flatMap((node) => {
    if (node.children.length === 0) {
      return [];
    }
    return [node.id, ...collectExpandedNodeIds(node.children)];
  });

export const formatPageValue = (node: DocumentationNode): string => `${node.page_start}-${node.page_end}`;

export const buildDocumentationCitationPayload = (
  docId: string,
  node: DocumentationNode,
): DocumentationCitationPayload => {
  const pageValue = formatPageValue(node);
  return {
    label: pageValue,
    type: docId,
    page: pageValue,
    pageValue,
  };
};

export const filterDocumentationNodes = (
  nodes: DocumentationNode[],
  filterText: string,
): DocumentationNode[] => {
  const normalizedFilter = normalizeFilterText(filterText);
  if (!normalizedFilter) {
    return nodes;
  }

  return nodes.flatMap((node) => {
    const filteredChildren = filterDocumentationNodes(node.children, normalizedFilter);
    const isSelfMatched = normalizeFilterText(`${node.title} ${node.summary}`).includes(normalizedFilter);
    if (!isSelfMatched && filteredChildren.length === 0) {
      return [];
    }
    return [{
      ...node,
      children: filteredChildren,
    }];
  });
};
