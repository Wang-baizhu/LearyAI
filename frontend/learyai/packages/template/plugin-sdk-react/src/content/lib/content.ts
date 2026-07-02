// 职责: 提供模板插件 content 组件内部使用的内容片段解析能力。
export interface ContentReference {
  label: string;
  source: string;
  page: string;
  pages: string[];
  raw: string;
}

export type ContentPart =
  | { kind: 'text'; value: string }
  | { kind: 'reference'; value: ContentReference };

const CITATION_BRACKET = String.raw`\\?\[`;
const CITATION_BRACKET_CLOSE = String.raw`\\?\]`;
const CITATION_PAREN_OPEN = String.raw`[\(（]`;
const CITATION_PAREN_CLOSE = String.raw`[\)）]`;
const CITATION_TOKEN_PATTERN = String.raw`${CITATION_BRACKET}(.*?)${CITATION_BRACKET_CLOSE}`;
const GROUPED_CITATION_PATTERN = String.raw`${CITATION_PAREN_OPEN}((?:${CITATION_TOKEN_PATTERN}){2,})${CITATION_PAREN_CLOSE}`;

const CONTENT_REFERENCE_REGEX = new RegExp(GROUPED_CITATION_PATTERN, 'g');
const CONTENT_REFERENCE_TOKEN_REGEX = new RegExp(CITATION_TOKEN_PATTERN, 'g');

const createContentReference = (raw: string, docId: string, pages: string[]): ContentReference => ({
  raw,
  label: docId.trim(),
  source: docId.trim(),
  page: pages[0].trim(),
  pages: pages.map((item) => item.trim()).filter((item) => item),
});

const parseContentReference = (raw: string): ContentReference | null => {
  const match = raw.match(new RegExp(`^${GROUPED_CITATION_PATTERN}$`));
  if (!match) {
    return null;
  }

  const tokens = Array.from(raw.matchAll(CONTENT_REFERENCE_TOKEN_REGEX)).map((item) =>
    String(item[1] ?? '').trim(),
  );
  if (tokens.length < 2) {
    return null;
  }

  const [docId, ...pages] = tokens;
  if (!docId || pages.length === 0) {
    return null;
  }

  return createContentReference(raw, docId, pages);
};

export const splitContentParts = (content: string): ContentPart[] => {
  const safeContent = typeof content === 'string' ? content : String(content ?? '');
  if (!safeContent) {
    return [];
  }

  const parts: ContentPart[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  CONTENT_REFERENCE_REGEX.lastIndex = 0;
  while ((match = CONTENT_REFERENCE_REGEX.exec(safeContent)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ kind: 'text', value: safeContent.slice(lastIndex, match.index) });
    }

    const reference = parseContentReference(match[0]);
    if (reference) {
      parts.push({ kind: 'reference', value: reference });
    } else {
      parts.push({ kind: 'text', value: match[0] });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < safeContent.length) {
    parts.push({ kind: 'text', value: safeContent.slice(lastIndex) });
  }

  return parts;
};
