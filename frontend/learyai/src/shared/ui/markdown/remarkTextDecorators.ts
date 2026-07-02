// remarkTextDecorators 负责提供 citation 与 timestamp 的可复用 Markdown 文本增强插件。
import { findTimestampRanges } from '@/shared/lib/timestampRange';
import { splitTextByCitations } from '@/shared/lib/citation';

type MarkdownTextNode = { type: 'text'; value: string };
type MarkdownElementNode = {
  type: string;
  children?: MarkdownNode[];
  value?: string;
  url?: string;
  title?: string;
  data?: {
    hName?: string;
    hProperties?: Record<string, string>;
  };
};
type MarkdownNode = MarkdownTextNode | MarkdownElementNode;
type MarkdownRoot = { type: string; children?: MarkdownNode[] };

const DOCUMENT_PAGE_MARKER_REGEX = /[（(]\s*page\s*[：:]\s*(\d+(?:\s*-\s*\d+)?)\s*[)）]/gi;

const hasChildren = (node: MarkdownNode): node is MarkdownElementNode & { children: MarkdownNode[] } =>
  Array.isArray((node as MarkdownElementNode).children);

const walkTextNodes = (tree: MarkdownRoot, splitTextToNodes: (value: string) => MarkdownNode[]) => {
  const walk = (node: MarkdownNode) => {
    if (!node || !hasChildren(node)) return;
    const skipTypes = new Set(['code', 'inlineCode', 'link', 'linkReference', 'definition']);
    const nextChildren: MarkdownNode[] = [];

    node.children.forEach((child) => {
      if (child.type === 'text' && !skipTypes.has(node.type)) {
        nextChildren.push(...splitTextToNodes(child.value ?? ''));
        return;
      }

      if (hasChildren(child)) {
        walk(child);
      }

      nextChildren.push(child);
    });

    node.children = nextChildren;
  };

  walk(tree as MarkdownNode);
};

export const createRemarkCitations = () => {
  return () => (tree: MarkdownRoot) => {
    const splitTextToNodes = (value: string) => {
      const nodes: MarkdownNode[] = [];
      splitTextByCitations(value).forEach((segment) => {
        if (segment.kind === 'text') {
          nodes.push({ type: 'text', value: segment.value });
          return;
        }

        const citation = {
          label: segment.value.label,
          type: segment.value.type,
          page: segment.value.page,
          pages: segment.value.pages,
        };

        nodes.push({
          type: 'link',
          url: '',
          title: citation.label,
          children: [{ type: 'text', value: citation.label }],
          data: {
            hName: 'citation',
            hProperties: {
              citationLabel: citation.label,
              citationType: citation.type,
              citationPage: citation.page,
              citationPages: (citation.pages ?? [citation.page]).join(','),
              'data-citation-label': citation.label,
              'data-citation-type': citation.type,
              'data-citation-page': citation.page,
              'data-citation-pages': (citation.pages ?? [citation.page]).join(','),
            },
          },
        });
      });

      return nodes;
    };

    walkTextNodes(tree, splitTextToNodes);
  };
};

export const createRemarkPageMarkers = (docId: string) => {
  return () => (tree: MarkdownRoot) => {
    const splitTextToNodes = (value: string) => {
      const nodes: MarkdownNode[] = [];
      let lastIndex = 0;
      let match: RegExpExecArray | null;

      DOCUMENT_PAGE_MARKER_REGEX.lastIndex = 0;
      while ((match = DOCUMENT_PAGE_MARKER_REGEX.exec(value)) !== null) {
        if (match.index > lastIndex) {
          nodes.push({ type: 'text', value: value.slice(lastIndex, match.index) });
        }

        const pageText = (match[1] ?? '').replace(/\s+/g, '');
        nodes.push({
          type: 'link',
          url: '',
          title: pageText,
          children: [{ type: 'text', value: pageText }],
          data: {
            hName: 'citation',
            hProperties: {
              citationLabel: pageText,
              citationType: docId,
              citationPage: pageText,
              citationPages: pageText,
              'data-citation-label': pageText,
              'data-citation-type': docId,
              'data-citation-page': pageText,
              'data-citation-pages': pageText,
            },
          },
        });

        lastIndex = match.index + match[0].length;
      }

      if (lastIndex < value.length) {
        nodes.push({ type: 'text', value: value.slice(lastIndex) });
      }

      return nodes;
    };

    walkTextNodes(tree, splitTextToNodes);
  };
};

export const createRemarkTimestamps = () => {
  return () => (tree: MarkdownRoot) => {
    const splitTextToNodes = (value: string) => {
      const nodes: MarkdownNode[] = [];
      const matches = findTimestampRanges(value);
      let lastIndex = 0;

      matches.forEach((match) => {
        if (match.index > lastIndex) {
          nodes.push({ type: 'text', value: value.slice(lastIndex, match.index) });
        }

        nodes.push({
          type: 'link',
          url: '',
          title: match.raw,
          children: [{ type: 'text', value: match.raw }],
          data: {
            hName: 'timestamp-link',
            hProperties: {
              startSeconds: String(match.startSeconds),
              'data-start-seconds': String(match.startSeconds),
            },
          },
        });

        lastIndex = match.index + match.raw.length;
      });

      if (lastIndex < value.length) {
        nodes.push({ type: 'text', value: value.slice(lastIndex) });
      }

      return nodes;
    };

    walkTextNodes(tree, splitTextToNodes);
  };
};
