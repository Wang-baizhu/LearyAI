// 职责: 解析 PPT 模板 content，并把可复用模板块展开为实际渲染页面序列。
export type PptTemplateSlot = {
  key: string;
  label: string;
  defaultContent: string;
};

export type PptTemplatePage = {
  pageNumber: number;
  pageId: string;
  templateId: string;
  title: string;
  typeLabel: string;
  htmlPath: string;
  html: string;
  slots: PptTemplateSlot[];
};

export type RenderedPptPage = PptTemplatePage & {
  occurrenceId: string;
  slotValues: Record<string, string> | null;
};

type ParsedPageContentOccurrence = {
  templateId: string;
  slots: Record<string, string>;
};

const parseMarkerAttributes = (raw: string): Record<string, string> => {
  const attrs: Record<string, string> = {};
  for (const match of raw.matchAll(/([a-zA-Z][\w-]*)=("[^"]*"|'[^']*'|[^\s]+)/g)) {
    attrs[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return attrs;
};

const parseSlotLines = (raw: string): Record<string, string> => {
  const slots: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('<!--')) {
      continue;
    }
    const separatorIndex = trimmed.indexOf(':');
    if (separatorIndex <= 0) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (key) {
      slots[key] = value;
    }
  }
  return slots;
};

export const parsePptContent = (content: string): ParsedPageContentOccurrence[] => {
  const pages: ParsedPageContentOccurrence[] = [];
  const markerPattern = /<!--\s*leary-ppt-page\s+([^>]*?)-->([\s\S]*?)<!--\s*\/leary-ppt-page\s*-->/g;
  for (const match of content.matchAll(markerPattern)) {
    const attrs = parseMarkerAttributes(match[1]);
    const templateId = attrs.template || attrs.templateId;
    if (!templateId) {
      continue;
    }
    pages.push({
      templateId,
      slots: parseSlotLines(match[2]),
    });
  }
  return pages;
};

export const resolveRenderedPages = (
  templatePages: PptTemplatePage[],
  occurrences: ParsedPageContentOccurrence[],
): RenderedPptPage[] => {
  if (occurrences.length === 0) {
    return templatePages.map((page) => ({
      ...page,
      occurrenceId: `template:${page.templateId}:default`,
      slotValues: null,
    }));
  }

  const pageByTemplateId = new Map(templatePages.map((page) => [page.templateId, page]));
  return occurrences.flatMap((occurrence, index) => {
    const page = pageByTemplateId.get(occurrence.templateId);
    if (!page) {
      return [];
    }
    return [{
      ...page,
      occurrenceId: `content:${index}:${occurrence.templateId}`,
      slotValues: occurrence.slots,
    }];
  });
};
