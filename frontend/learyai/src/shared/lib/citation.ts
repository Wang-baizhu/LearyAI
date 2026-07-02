// citation 负责解析 docId + pages 形式的引用并提供可复用的文本切分能力。

export interface CitationMeta {
  label: string;
  type: string;
  page: string;
  pages: string[];
  raw: string;
}

export type CitationSegment =
  | { kind: 'text'; value: string }
  | { kind: 'citation'; value: CitationMeta };

const CITATION_BRACKET = String.raw`\\?\[`;
const CITATION_BRACKET_CLOSE = String.raw`\\?\]`;
const CITATION_PAREN_OPEN = String.raw`[\(（]`;
const CITATION_PAREN_CLOSE = String.raw`[\)）]`;
const CITATION_TOKEN_PATTERN = String.raw`${CITATION_BRACKET}(.*?)${CITATION_BRACKET_CLOSE}`;
const GROUPED_CITATION_PATTERN = String.raw`${CITATION_PAREN_OPEN}((?:${CITATION_TOKEN_PATTERN}){2,})${CITATION_PAREN_CLOSE}`;

const FULL_CITATION_REGEX = new RegExp(GROUPED_CITATION_PATTERN, 'g');
const CITATION_REGEX = new RegExp(GROUPED_CITATION_PATTERN, 'g');

const CITATION_TOKEN_REGEX = new RegExp(CITATION_TOKEN_PATTERN, 'g');

const createCitationMeta = (raw: string, label: string, type: string, page: string, pages?: string[]): CitationMeta => ({
  label: label.trim(),
  type: type.trim(),
  page: page.trim(),
  pages: (pages ?? [page]).map((item) => item.trim()).filter((item) => item),
  raw,
});

export const parseCitationRaw = (raw: string): CitationMeta | null => {
  return parseCitationGroupRaw(raw);
};

export const parseCitationGroupRaw = (raw: string): CitationMeta | null => {
  const match = raw.match(new RegExp(`^${GROUPED_CITATION_PATTERN}$`));
  if (!match) return null;

  const tokens = Array.from(raw.matchAll(CITATION_TOKEN_REGEX)).map((item) => String(item[1] ?? '').trim());
  if (tokens.length < 2) return null;

  const [docId, ...pages] = tokens;
  const resolvedPages = pages.filter((page) => page);
  if (resolvedPages.length === 0) return null;
  return createCitationMeta(raw, docId, docId, resolvedPages[0], resolvedPages);
};

export const findFullCitations = (text: string): CitationMeta[] => {
  const citations: CitationMeta[] = [];
  let match: RegExpExecArray | null;

  FULL_CITATION_REGEX.lastIndex = 0;
  while ((match = FULL_CITATION_REGEX.exec(text)) !== null) {
    const citation = parseCitationGroupRaw(match[0]);
    if (citation) {
      citations.push(citation);
    }
  }

  return citations;
};

export const splitTextByCitations = (text: string): CitationSegment[] => {
  const segments: CitationSegment[] = [];
  const safeText = typeof text === 'string' ? text : String(text ?? '');
  if (!safeText) return segments;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  CITATION_REGEX.lastIndex = 0;
  while ((match = CITATION_REGEX.exec(safeText)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ kind: 'text', value: safeText.slice(lastIndex, match.index) });
    }

    const parsedCitation = parseCitationGroupRaw(match[0]);
    if (parsedCitation) {
      segments.push({ kind: 'citation', value: parsedCitation });
    } else {
      segments.push({ kind: 'text', value: match[0] });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < safeText.length) {
    segments.push({ kind: 'text', value: safeText.slice(lastIndex) });
  }

  return segments;
};

export const normalizeCitationPageValue = (page: string) => {
  const safePage = String(page ?? '').trim();
  return safePage.toUpperCase().startsWith('P') ? safePage.slice(1) : safePage;
};

export const formatCitationDisplayText = (params: {
  docName?: string | null;
  page?: string | null;
  fallbackText?: string;
}) => {
  const { docName, page, fallbackText = '' } = params;
  const resolvedDocName = String(docName ?? '').trim();
  const pageValue = normalizeCitationPageValue(String(page ?? ''));

  if (!resolvedDocName) return fallbackText;
  if (!pageValue) return `《${resolvedDocName}》`;
  return `《${resolvedDocName}》 P${pageValue}`;
};
