// markdown/lib 负责承载 Markdown 渲染相关的纯函数、类型与 remark 插件。
import React from 'react';
import type { Node } from 'unist';
import { visit } from 'unist-util-visit';

type MarkdownValueNode = { value?: unknown };
type MarkdownPosition = {
  start?: { offset?: number };
  end?: { offset?: number };
};
type MarkdownTextNode = { type: 'text'; value: string; position?: MarkdownPosition };
type MarkdownHastTextNode = { type: 'text'; value: string };
type MarkdownHastElementNode = {
  type: 'element';
  tagName: string;
  properties?: Record<string, unknown>;
  children: MarkdownHastTextNode[];
};
type MarkdownInlineMathNode = {
  type: 'inlineMath';
  value: string;
  position?: MarkdownPosition;
  data?: {
    hName?: string;
    hProperties?: Record<string, unknown>;
    hChildren?: MarkdownHastTextNode[];
  };
};
type MarkdownMathNode = {
  type: 'math';
  value: string;
  position?: MarkdownPosition;
  data?: {
    hName?: string;
    hChildren?: MarkdownHastElementNode[];
  };
};
type MarkdownPhrasingNode = MarkdownTextNode | MarkdownInlineMathNode;
type MarkdownParentNode = {
  type: string;
  children?: Array<MarkdownParentNode | MarkdownPhrasingNode | MarkdownMathNode>;
  position?: MarkdownPosition;
};
const ESCAPED_CITATION_SEGMENT_PATTERN = String.raw`\\?\[[^\]\r\n]+]`;
const ESCAPED_CITATION_PATTERN = new RegExp(
  String.raw`\(\s*${ESCAPED_CITATION_SEGMENT_PATTERN}\s*${ESCAPED_CITATION_SEGMENT_PATTERN}(?:\s*${ESCAPED_CITATION_SEGMENT_PATTERN})?\s*\)`,
  'g'
);
const BLOCK_TEX_PATTERN = /\\\[([\s\S]+?)\\\]/g;
const BLOCK_DOLLAR_PATTERN = /\$\$([\s\S]+?)\$\$/g;
const INLINE_TEX_PATTERN = /\\\(([\s\S]+?)\\\)/g;
const CITATION_TOKEN = '@@LEARY_CITATION_';
const STREAMED_TABLE_HEADER_GLUE_PATTERN =
  /(\|[^\n]*?\|)(?=\|\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?)/g;
const STREAMED_TABLE_DELIMITER_GLUE_PATTERN =
  /(\|\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?)(?=\|\s*[^|\s-][^\n]*\|)/g;
const FENCED_CODE_BLOCK_PATTERN = /(```|~~~)[^\n]*\n[\s\S]*?\n\1/g;
const INLINE_CODE_SPAN_PATTERN = /`[^`\n]+`/g;
const MATRIX_ENV_PATTERN = /\\begin\{([a-zA-Z*]+)\}/;
const MATRIX_ENV_END_PATTERN = /\\end\{([a-zA-Z*]+)\}/;
const MATRIX_ROW_PATTERN = /(?:^|[^\w\\])&|\\\\/;

const syncMathNodeRenderData = (node: MarkdownInlineMathNode | MarkdownMathNode, normalizedValue: string) => {
  if (node.type === 'inlineMath') {
    node.data?.hChildren?.forEach((child) => {
      child.value = normalizedValue;
    });
    return;
  }

  node.data?.hChildren?.forEach((child) => {
    child.children.forEach((textChild) => {
      textChild.value = normalizedValue;
    });
  });
};

export type FullscreenPreviewState =
  | {
      kind: 'code';
      title: string;
      language: string;
      content: string;
    }
  | {
      kind: 'table';
      title: string;
      content: React.ReactNode;
      copyText: string;
    };

export const remarkTrimMath = () => {
  return (tree: Node) => {
    visit(tree, (node: Node) => {
      if (isInlineMathNode(node)) {
        const normalizedValue = normalizeMathNodeValue(node.value, false);
        node.value = normalizedValue;
        syncMathNodeRenderData(node, normalizedValue);
        return;
      }

      if (isBlockMathNode(node)) {
        const normalizedValue = normalizeMathNodeValue(node.value, true);
        node.value = normalizedValue;
        syncMathNodeRenderData(node, normalizedValue);
      }
    });
  };
};

const repairBlockMatrixEnvironment = (value: string) => {
  const trimmed = value.trim();
  const beginMatch = trimmed.match(MATRIX_ENV_PATTERN);
  const endMatch = trimmed.match(MATRIX_ENV_END_PATTERN);
  const looksLikeMatrixRows = MATRIX_ROW_PATTERN.test(trimmed);

  if (beginMatch && endMatch) {
    return trimmed;
  }

  if (beginMatch && !endMatch) {
    return `${trimmed}\n\\end{${beginMatch[1]}}`;
  }

  if (!beginMatch && endMatch) {
    return `\\begin{${endMatch[1]}}\n${trimmed}`;
  }

  if (!looksLikeMatrixRows) {
    return trimmed;
  }

  return `\\begin{aligned}\n${trimmed}\n\\end{aligned}`;
};

const normalizeMathNodeValue = (value: string, isBlockMath: boolean) => {
  const trimmed = value.trim();
  if (!isBlockMath) {
    return trimmed;
  }
  return repairBlockMatrixEnvironment(trimmed);
};

const protectEscapedCitations = (text: string) => {
  const citations: string[] = [];
  const protectedText = text.replace(ESCAPED_CITATION_PATTERN, (match) => {
    const token = `${CITATION_TOKEN}${citations.length}@@`;
    citations.push(match);
    return token;
  });

  return { protectedText, citations };
};

const restoreProtectedText = (text: string, citations: string[]) =>
  citations.reduce((result, citation, index) => {
    return result.replace(`${CITATION_TOKEN}${index}@@`, citation);
  }, text);

const createTextNode = (value: string): MarkdownTextNode | null => {
  if (!value) return null;
  return { type: 'text', value };
};

const normalizePlainMarkdownText = (value: string) => {
  return value.replace(/\\([()[\]])/g, '$1');
};

const sliceSourceByPosition = (source: string, position?: MarkdownPosition) => {
  const start = position?.start?.offset;
  const end = position?.end?.offset;
  if (typeof start !== 'number' || typeof end !== 'number') {
    return null;
  }
  return source.slice(start, end);
};

const createInlineMathNode = (value: string): MarkdownInlineMathNode => ({
  type: 'inlineMath',
  value,
  data: {
    hName: 'code',
    hProperties: { className: ['language-math', 'math-inline'] },
    hChildren: [{ type: 'text', value }],
  },
});

const createBlockMathNode = (value: string): MarkdownMathNode => ({
  type: 'math',
  value,
  data: {
    hName: 'pre',
    hChildren: [
      {
        type: 'element',
        tagName: 'code',
        properties: { className: ['language-math', 'math-display'] },
        children: [{ type: 'text', value }],
      },
    ],
  },
});

const extractMultilineDollarMath = (value: string) => {
  const match = value.match(/\$\$([\s\S]+?)\$\$/);
  if (!match) {
    return null;
  }
  const mathBody = match[1] ?? '';
  if (!match[0].includes('\n') && !mathBody.includes('\n')) {
    return null;
  }
  return mathBody.trim();
};

const isParentNode = (
  node: MarkdownParentNode | MarkdownPhrasingNode | MarkdownMathNode
): node is MarkdownParentNode => {
  return Array.isArray((node as MarkdownParentNode).children);
};

const isTextNode = (
  node: MarkdownParentNode | MarkdownPhrasingNode | MarkdownMathNode
): node is MarkdownTextNode => {
  return node.type === 'text';
};

const isParagraphNode = (
  node: MarkdownParentNode | MarkdownPhrasingNode | MarkdownMathNode
): node is MarkdownParentNode & { type: 'paragraph' } => {
  return node.type === 'paragraph';
};

const isMathLikeNode = (
  node: MarkdownParentNode | MarkdownPhrasingNode | MarkdownMathNode
): node is MarkdownInlineMathNode | MarkdownMathNode => {
  return node.type === 'inlineMath' || node.type === 'math';
};

const isInlineMathNode = (node: Node): node is Node & MarkdownInlineMathNode => {
  return node.type === 'inlineMath' && typeof (node as MarkdownValueNode).value === 'string';
};

const isBlockMathNode = (node: Node): node is Node & MarkdownMathNode => {
  return node.type === 'math' && typeof (node as MarkdownValueNode).value === 'string';
};

const splitInlineTeXNodes = (value: string): MarkdownPhrasingNode[] => {
  if (!value || value.includes('`')) {
    const textNode = createTextNode(value);
    return textNode ? [textNode] : [];
  }

  const { protectedText, citations } = protectEscapedCitations(value);
  const nodes: MarkdownPhrasingNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  INLINE_TEX_PATTERN.lastIndex = 0;
  while ((match = INLINE_TEX_PATTERN.exec(protectedText)) !== null) {
    const before = normalizePlainMarkdownText(
      restoreProtectedText(protectedText.slice(lastIndex, match.index), citations)
    );
    const textNode = createTextNode(before);
    if (textNode) {
      nodes.push(textNode);
    }

    nodes.push(createInlineMathNode((match[1] ?? '').trim()));

    lastIndex = match.index + match[0].length;
  }

  const after = normalizePlainMarkdownText(restoreProtectedText(protectedText.slice(lastIndex), citations));
  const trailingTextNode = createTextNode(after);
  if (trailingTextNode) {
    nodes.push(trailingTextNode);
  }

  return nodes;
};

const splitParagraphByBlockTeX = (value: string) => {
  if (!value || value.includes('`')) {
    return [{ kind: 'text' as const, value }];
  }

  const { protectedText, citations } = protectEscapedCitations(value);
  const segments: Array<{ kind: 'text'; value: string } | { kind: 'math'; value: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  BLOCK_TEX_PATTERN.lastIndex = 0;
  while ((match = BLOCK_TEX_PATTERN.exec(protectedText)) !== null) {
    const before = restoreProtectedText(protectedText.slice(lastIndex, match.index), citations);
    if (before) {
      segments.push({ kind: 'text', value: before });
    }

    segments.push({
      kind: 'math',
      value: (match[1] ?? '').trim(),
    });

    lastIndex = match.index + match[0].length;
  }

  const after = restoreProtectedText(protectedText.slice(lastIndex), citations);
  if (after) {
    segments.push({ kind: 'text', value: after });
  }

  return segments;
};

const splitParagraphByBlockDollarMath = (value: string) => {
  if (!value || value.includes('`')) {
    return [{ kind: 'text' as const, value }];
  }

  const { protectedText, citations } = protectEscapedCitations(value);
  const segments: Array<{ kind: 'text'; value: string } | { kind: 'math'; value: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  BLOCK_DOLLAR_PATTERN.lastIndex = 0;
  while ((match = BLOCK_DOLLAR_PATTERN.exec(protectedText)) !== null) {
    const rawMathBlock = match[0] ?? '';
    const mathBody = match[1] ?? '';
    const shouldTreatAsBlock = rawMathBlock.includes('\n') || mathBody.includes('\n');
    if (!shouldTreatAsBlock) {
      continue;
    }

    const before = restoreProtectedText(protectedText.slice(lastIndex, match.index), citations);
    if (before) {
      segments.push({ kind: 'text', value: before });
    }

    segments.push({
      kind: 'math',
      value: mathBody.trim(),
    });

    lastIndex = match.index + rawMathBlock.length;
  }

  const after = restoreProtectedText(protectedText.slice(lastIndex), citations);
  if (after) {
    segments.push({ kind: 'text', value: after });
  }

  return segments;
};

const splitParagraphNodes = (
  value: string
): Array<MarkdownParentNode | MarkdownMathNode> => {
  const nextNodes: Array<MarkdownParentNode | MarkdownMathNode> = [];

  const normalizedSegments = splitParagraphByBlockTeX(value).flatMap((segment) => {
    if (segment.kind === 'math') {
      return [segment];
    }
    return splitParagraphByBlockDollarMath(segment.value);
  });

  normalizedSegments.forEach((segment) => {
    if (segment.kind === 'math') {
      nextNodes.push(createBlockMathNode(segment.value));
      return;
    }

    if (!segment.value.trim()) {
      return;
    }

    const inlineNodes = splitInlineTeXNodes(segment.value);
    if (inlineNodes.length === 0) {
      return;
    }

    nextNodes.push({
      type: 'paragraph',
      children: inlineNodes,
    });
  });

  return nextNodes;
};

const hasRenderableParagraphContent = (
  children: Array<MarkdownParentNode | MarkdownPhrasingNode | MarkdownMathNode>
) => {
  return children.some((child) => !isTextNode(child) || child.value.trim().length > 0);
};

const walkContainers = (node: MarkdownParentNode, visitor: (node: MarkdownParentNode) => void) => {
  visitor(node);
  node.children?.forEach((child) => {
    if (isParentNode(child)) {
      walkContainers(child, visitor);
    }
  });
};

export const remarkTeXMathCompat = (sourceText: string) => {
  return (tree: Node) => {
    walkContainers(tree as MarkdownParentNode, (container) => {
      if (!Array.isArray(container.children)) return;

      const nextChildren: Array<MarkdownParentNode | MarkdownPhrasingNode | MarkdownMathNode> = [];

      container.children.forEach((child) => {
        if (isParagraphNode(child)) {
          const paragraphChildren = child.children;
          if (!paragraphChildren?.length) {
            nextChildren.push(child);
            return;
          }

          if (paragraphChildren.every(isTextNode)) {
            const paragraphText =
              sliceSourceByPosition(sourceText, child.position) ??
              paragraphChildren.map((paragraphChild) => paragraphChild.value).join('');
            nextChildren.push(...splitParagraphNodes(paragraphText));
            return;
          }

          const nextParagraphChildren: Array<MarkdownParentNode | MarkdownPhrasingNode | MarkdownMathNode> = [];
          const flushParagraph = () => {
            if (!hasRenderableParagraphContent(nextParagraphChildren)) {
              nextParagraphChildren.length = 0;
              return;
            }

            nextChildren.push({
              type: 'paragraph',
              children: [...nextParagraphChildren],
            });
            nextParagraphChildren.length = 0;
          };

          paragraphChildren.forEach((paragraphChild) => {
            if (!isTextNode(paragraphChild)) {
              nextParagraphChildren.push(paragraphChild);
              return;
            }

            const rawText =
              sliceSourceByPosition(sourceText, paragraphChild.position) ?? paragraphChild.value;
            const textSegments = splitParagraphByBlockTeX(rawText).flatMap((segment) => {
              if (segment.kind === 'math') {
                return [segment];
              }
              return splitParagraphByBlockDollarMath(segment.value);
            });

            textSegments.forEach((segment) => {
              if (segment.kind === 'math') {
                flushParagraph();
                nextChildren.push(createBlockMathNode(segment.value));
                return;
              }

              nextParagraphChildren.push(...splitInlineTeXNodes(segment.value));
            });
          });
          flushParagraph();
          return;
        }

        if (isTextNode(child)) {
          const rawText = sliceSourceByPosition(sourceText, child.position) ?? child.value;
          nextChildren.push(...splitInlineTeXNodes(rawText));
          return;
        }

        if (isMathLikeNode(child)) {
          const rawMathSource = sliceSourceByPosition(sourceText, child.position) ?? child.value;
          const multilineDollarMath = extractMultilineDollarMath(rawMathSource);
          if (multilineDollarMath) {
            nextChildren.push(createBlockMathNode(normalizeMathNodeValue(multilineDollarMath, true)));
            return;
          }
        }

        nextChildren.push(child);
      });

      container.children = nextChildren;
    });
  };
};

export const resolveLanguageLabel = (className?: string) => {
  const match = className?.match(/language-([\w-]+)/);
  return match?.[1]?.toUpperCase() ?? 'CODE';
};

const isTableSeparatorCell = (value: string) => /^:?-{3,}:?$/.test(value.trim());

const countPipes = (value: string) => Array.from(value).filter((char) => char === '|').length;

const STANDALONE_TABLE_SEPARATOR_LINE_PATTERN =
  /^\s*\|?\s*:?-{3,}:?(?:\s*\|\s*:?-{3,}:?)+\s*\|?\s*$/m;

const looksLikeFlattenedStreamedTable = (value: string) =>
  value.trim().startsWith('|') &&
  countPipes(value) >= 6 &&
  (value.match(STREAMED_TABLE_HEADER_GLUE_PATTERN) !== null ||
    value.match(STREAMED_TABLE_DELIMITER_GLUE_PATTERN) !== null ||
    (!value.includes('\n') && value.match(/\|\s*\|/g) !== null) ||
    (!value.includes('\n') && !STANDALONE_TABLE_SEPARATOR_LINE_PATTERN.test(value)));

const extractFlattenedTableCells = (value: string) =>
  value
    .replace(/\n+/g, ' ')
    .split('|')
    .map((segment) => segment.trim())
    .filter((segment, index, collection) => {
      if (segment.length > 0) {
        return true;
      }

      return index !== 0 && index !== collection.length - 1;
    });

const inferTableColumnCount = (cells: string[]) => {
  const separatorStart = cells.findIndex((cell) => isTableSeparatorCell(cell));
  if (separatorStart >= 2) {
    if (cells[separatorStart - 1] === '' && separatorStart - 1 >= 2) {
      return separatorStart - 1;
    }
    return separatorStart;
  }

  for (let columnCount = Math.min(6, Math.floor(cells.length / 2)); columnCount >= 2; columnCount -= 1) {
    if (cells.length <= columnCount) {
      continue;
    }

    const remaining = cells.length - columnCount;
    if (remaining >= columnCount && remaining % columnCount === 0) {
      return columnCount;
    }
  }

  return -1;
};

const rebuildFlattenedTableParagraph = (value: string) => {
  if (!looksLikeFlattenedStreamedTable(value)) {
    return null;
  }

  const cells = extractFlattenedTableCells(value);
  const columnCount = inferTableColumnCount(cells);
  if (columnCount < 2) {
    return null;
  }

  const headerCells = cells.slice(0, columnCount);

  if (headerCells.length !== columnCount) {
    return null;
  }

  let dataStartIndex = columnCount;
  if (cells[dataStartIndex] === '') {
    dataStartIndex += 1;
  }
  while (dataStartIndex < cells.length && isTableSeparatorCell(cells[dataStartIndex] ?? '')) {
    dataStartIndex += 1;
  }
  if (cells[dataStartIndex] === '') {
    dataStartIndex += 1;
  }

  const dataCells = cells.slice(dataStartIndex);
  if (dataCells.every((cell) => cell.length === 0)) {
    return null;
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  dataCells.forEach((cell) => {
    if (cell.length === 0 && currentRow.length === 0) {
      return;
    }

    currentRow.push(cell);
    if (currentRow.length === columnCount) {
      rows.push(currentRow);
      currentRow = [];
    }
  });

  if (currentRow.length > 0) {
    while (currentRow.length < columnCount) {
      currentRow.push('');
    }
    rows.push(currentRow);
  }

  if (rows.length === 0) {
    return null;
  }

  return [
    `| ${headerCells.join(' | ')} |`,
    `| ${Array.from({ length: columnCount }, () => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
};

const normalizeFlattenedTableParagraph = (value: string) => {
  if (!value.includes('|') || !looksLikeFlattenedStreamedTable(value)) {
    return value;
  }

  return rebuildFlattenedTableParagraph(value) ?? value;
};

const protectMarkdownCodeSyntax = (text: string) => {
  const protectedSegments: string[] = [];
  const replaceWithToken = (value: string) => {
    const token = `@@LEARY_MARKDOWN_CODE_${protectedSegments.length}@@`;
    protectedSegments.push(value);
    return token;
  };

  const protectedText = text
    .replace(FENCED_CODE_BLOCK_PATTERN, replaceWithToken)
    .replace(INLINE_CODE_SPAN_PATTERN, replaceWithToken);

  return { protectedText, protectedSegments };
};

const restoreProtectedMarkdownCodeSyntax = (text: string, protectedSegments: string[]) => {
  return protectedSegments.reduce((result, segment, index) => {
    return result.replace(`@@LEARY_MARKDOWN_CODE_${index}@@`, segment);
  }, text);
};

export const normalizeStreamedMarkdownTables = (text: string) => {
  const { protectedText, protectedSegments } = protectMarkdownCodeSyntax(text);
  const normalizedText = protectedText
    .split(/(\n{2,})/)
    .map((segment) => (segment.startsWith('\n\n') ? segment : normalizeFlattenedTableParagraph(segment)))
    .join('');

  return restoreProtectedMarkdownCodeSyntax(normalizedText, protectedSegments);
};

export const extractTextContent = (value: React.ReactNode): string => {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(extractTextContent).join('');
  }
  if (React.isValidElement<{ children?: React.ReactNode }>(value)) {
    return extractTextContent(value.props.children);
  }
  return '';
};

export const renderNodeWithLineBreaks = (value: React.ReactNode): React.ReactNode => {
  if (typeof value === 'string' || typeof value === 'number') {
    const text = String(value);
    if (!/<br\s*\/?>/i.test(text)) {
      return value;
    }
    return text.split(/<br\s*\/?>/gi).flatMap((segment, index) => {
      if (index === 0) {
        return [segment];
      }
      return [<br key={`br-${index}`} />, segment];
    });
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => (
      <React.Fragment key={index}>{renderNodeWithLineBreaks(item)}</React.Fragment>
    ));
  }

  if (React.isValidElement<{ children?: React.ReactNode }>(value)) {
    return React.cloneElement(value, {
      ...value.props,
      children: renderNodeWithLineBreaks(value.props.children),
    });
  }

  return value;
};

export const extractCodeBlockMeta = (children: React.ReactNode) => {
  const firstChild = React.Children.toArray(children)[0];
  if (!React.isValidElement<{ className?: string; children?: React.ReactNode }>(firstChild)) {
    return null;
  }
  const content = extractTextContent(firstChild.props.children).replace(/\n$/, '');
  return {
    className: firstChild.props.className,
    content,
  };
};

export const buildTableCopyText = (tableElement: HTMLTableElement) =>
  Array.from(tableElement.querySelectorAll('tr'))
    .map((row) =>
      Array.from(row.querySelectorAll('th, td'))
        .map((cell) => (cell.textContent ?? '').trim())
        .join('\t')
    )
    .join('\n');
