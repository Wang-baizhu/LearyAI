// 职责: 定义 PPT 预览编辑协议、类型与 HTML patch 工具。
import { buildPptEditRuntimeScript } from './pptEditRuntime';

export const PPT_EDIT_CHANNEL = 'leary:template-plugin:devtools:ppt-edit';
export const PPT_EDIT_COMMAND_TYPE = `${PPT_EDIT_CHANNEL}:command`;
export const PPT_EDIT_EVENT_TYPE = `${PPT_EDIT_CHANNEL}:event`;

export type PptEditCommandName = 'set-mode' | 'apply-patch' | 'clear-selection' | 'undo';

export interface PptEditTargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PptEditSelectionSnapshot {
  pageNumber?: number;
  selector: string;
  tagName: string;
  text: string;
  rect: PptEditTargetRect;
  style: {
    color: string;
    fontSize: string;
    fontWeight: string;
    backgroundColor: string;
    opacity: string;
    zIndex: string;
    left: string;
    top: string;
    width: string;
    height: string;
  };
}

export interface PptEditStylePatch {
  selector: string;
  text?: string;
  style?: Partial<PptEditSelectionSnapshot['style']>;
}

export interface PptEditCommandMessage {
  type: typeof PPT_EDIT_COMMAND_TYPE;
  command: PptEditCommandName;
  payload?: {
    enabled?: boolean;
    managedUndo?: boolean;
    patch?: PptEditStylePatch;
  };
}

export interface PptEditEventMessage {
  type: typeof PPT_EDIT_EVENT_TYPE;
  event: 'selection-changed' | 'html-changed' | 'patch-applied' | 'undo-request' | 'preview-state-changed';
  payload: {
    selection?: PptEditSelectionSnapshot | null;
    html?: string;
    patch?: PptEditStylePatch;
    isTemplateBuilderPage?: boolean;
  };
}

const editableScript = buildPptEditRuntimeScript({
  commandType: PPT_EDIT_COMMAND_TYPE,
  eventType: PPT_EDIT_EVENT_TYPE,
});

const hasMeaningfulTextNode = (element: HTMLElement) =>
  [...element.childNodes].some(
    (node) => node.nodeType === Node.TEXT_NODE && String(node.textContent ?? '').trim().length > 0,
  );

const collectTextStyleTargets = (root: HTMLElement) => {
  const seen = new Set<HTMLElement>();
  const targets: HTMLElement[] = [];
  const textWalker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);

  for (let node = textWalker.nextNode(); node; node = textWalker.nextNode()) {
    if (String(node.textContent ?? '').trim().length <= 0) {
      continue;
    }
    const parent = node.parentElement;
    if (!parent || !root.contains(parent) || seen.has(parent)) {
      continue;
    }
    seen.add(parent);
    targets.push(parent);
  }

  if (targets.length > 0) {
    return targets;
  }
  return hasMeaningfulTextNode(root) ? [root] : [];
};

const applyTextStyleValue = (
  root: HTMLElement,
  name: 'color' | 'font-size' | 'font-weight',
  value: string | undefined,
) => {
  if (value === undefined) {
    return;
  }
  const normalized = String(value).trim();
  const targets = collectTextStyleTargets(root);
  if (targets.length === 0) {
    return;
  }
  targets.forEach((target) => {
    if (normalized) {
      target.style.setProperty(name, normalized, 'important');
      return;
    }
    target.style.removeProperty(name);
  });
};

const collectSegmentTextNodes = (root: HTMLElement): Text[][] => {
  const segments: Text[][] = [[]];
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_ALL);

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) {
      segments.at(-1)?.push(node as Text);
      continue;
    }
    if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === 'BR') {
      segments.push([]);
    }
  }

  return segments;
};

const writeLineToTextNodes = (textNodes: Text[], line: string) => {
  if (textNodes.length === 0) {
    return;
  }

  const nodeLengths = textNodes.map((node) => (node.textContent ?? '').length);
  const totalLength = nodeLengths.reduce((sum, length) => sum + length, 0);
  if (totalLength <= 0) {
    textNodes[0].textContent = line;
    textNodes.slice(1).forEach((node) => {
      node.textContent = '';
    });
    return;
  }

  let previousEnd = 0;
  textNodes.forEach((node, index) => {
    if (index === textNodes.length - 1) {
      node.textContent = line.slice(previousEnd);
      return;
    }
    const cumulativeLength = nodeLengths
      .slice(0, index + 1)
      .reduce((sum, currentLength) => sum + currentLength, 0);
    const nextEnd = Math.round((line.length * cumulativeLength) / totalLength);
    node.textContent = line.slice(previousEnd, nextEnd);
    previousEnd = nextEnd;
  });
};

const applyTextContentPreservingMarkup = (root: HTMLElement, value: string) => {
  const textSegments = collectSegmentTextNodes(root);
  if (textSegments.every((segment) => segment.length === 0)) {
    root.textContent = value;
    return;
  }

  const lines = value.split(/\r?\n/);
  textSegments.forEach((segmentNodes, index) => {
    writeLineToTextNodes(segmentNodes, index < lines.length ? lines[index] ?? '' : '');
  });
};

export const buildPptEditablePageSrcdoc = (html: string) => {
  const scriptTag = `<script>${editableScript}</script>`;
  if (html.includes('</body>')) {
    return html.replace('</body>', `${scriptTag}</body>`);
  }
  return `${html}${scriptTag}`;
};

export const applyPptEditPatchToHtml = (html: string, patch: PptEditStylePatch) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const element = doc.querySelector<HTMLElement>(patch.selector);
  if (!element) {
    return html;
  }
  if (typeof patch.text === 'string') {
    applyTextContentPreservingMarkup(element, patch.text);
  }
  if (patch.style) {
    Object.entries({
      'font-size': patch.style.fontSize,
      'background-color': patch.style.backgroundColor,
      opacity: patch.style.opacity,
      'z-index': patch.style.zIndex,
      left: patch.style.left,
      top: patch.style.top,
      width: patch.style.width,
      height: patch.style.height,
    }).forEach(([name, value]) => {
      if (value === undefined) {
        return;
      }
      const normalized = String(value).trim();
      if (normalized) {
        element.style.setProperty(name, normalized, 'important');
      } else {
        element.style.removeProperty(name);
      }
    });
    applyTextStyleValue(element, 'color', patch.style.color);
    applyTextStyleValue(element, 'font-size', patch.style.fontSize);
    applyTextStyleValue(element, 'font-weight', patch.style.fontWeight);
    if ((patch.style.left !== undefined || patch.style.top !== undefined) && !element.style.position) {
      element.style.setProperty('position', 'absolute', 'important');
    }
  }
  return `<!doctype html>\n${doc.documentElement.outerHTML}`;
};
