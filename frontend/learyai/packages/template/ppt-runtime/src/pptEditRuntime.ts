// 职责: 生成 PPT 预览编辑运行时脚本，供模板正式预览与导入工作台共用。
interface BuildPptEditRuntimeScriptOptions {
  commandType: string;
  eventType: string;
}

export const buildPptEditRuntimeScript = ({
  commandType,
  eventType,
}: BuildPptEditRuntimeScriptOptions) => `
(() => {
  const COMMAND_TYPE = '${commandType}';
  const EVENT_TYPE = '${eventType}';
  const SELECTABLE_SELECTOR = '[data-leary-ppt-slot], [data-block-id]';
  const STYLE_ID = 'leary-ppt-edit-style';
  const OVERLAY_ID = 'leary-ppt-edit-overlay';
  const SLOT_HINT_ID = 'leary-ppt-slot-hint';
  const SELECTED_CLASS = 'leary-ppt-edit-selected';
  const HOVER_CLASS = 'leary-ppt-edit-hover';
  const HANDLE_CLASS = 'leary-ppt-edit-handle';
  let enabled = false;
  let selectedElement = null;
  let hoverElement = null;
  let overlayElement = null;
  let slotHintElement = null;
  let manipulationState = null;
  let didManipulate = false;
  let managedUndo = false;
  let suppressNextClick = false;
  const undoStack = [];

  const normalizeText = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
  const hasMeaningfulTextNode = (element) => Array.prototype.some.call(
    element.childNodes || [],
    (node) => node && node.nodeType === Node.TEXT_NODE && normalizeText(node.textContent).length > 0,
  );
  const findTextStyleSource = (root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (normalizeText(node.textContent).length <= 0) continue;
      if (node.parentElement && root.contains(node.parentElement)) {
        return node.parentElement;
      }
    }
    return root;
  };
  const collectTextStyleTargets = (root) => {
    const targets = [];
    const seen = new Set();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (normalizeText(node.textContent).length <= 0) continue;
      const parent = node.parentElement;
      if (!parent || !root.contains(parent) || seen.has(parent)) continue;
      seen.add(parent);
      targets.push(parent);
    }
    if (targets.length > 0) return targets;
    return hasMeaningfulTextNode(root) ? [root] : [];
  };
  const readTextStyleValue = (element, name) => {
    const targets = collectTextStyleTargets(element);
    if (targets.length === 0) {
      return element.style.getPropertyValue(name);
    }
    return targets[0].style.getPropertyValue(name);
  };
  const collectSegmentTextNodes = (root) => {
    const segments = [[]];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ALL);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE) {
        segments[segments.length - 1]?.push(node);
        continue;
      }
      if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'BR') {
        segments.push([]);
      }
    }
    return segments;
  };
  const writeLineToTextNodes = (textNodes, line) => {
    if (textNodes.length === 0) return;
    const nodeLengths = textNodes.map((node) => String(node.textContent || '').length);
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
  const applyTextContentPreservingMarkup = (element, value) => {
    const textSegments = collectSegmentTextNodes(element);
    if (textSegments.every((segment) => segment.length === 0)) {
      element.textContent = value;
      return;
    }
    const lines = String(value).split(/\\r?\\n/);
    textSegments.forEach((segmentNodes, index) => {
      writeLineToTextNodes(segmentNodes, index < lines.length ? lines[index] || '' : '');
    });
  };
  const cssEscape = (value) => {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(String(value));
    }
    return String(value).replace(/[^a-zA-Z0-9_-]/g, (char) => '\\\\' + char);
  };
  const attrEscape = (value) => String(value).replace(/"/g, '\\\\"');
  const isUniqueSelector = (selector) => {
    try {
      return document.querySelectorAll(selector).length === 1;
    } catch (_error) {
      return false;
    }
  };
  const buildNthChildSelector = (element) => {
    const segments = [];
    let current = element;
    while (current && current instanceof Element && current !== document.body && current !== document.documentElement) {
      const parent = current.parentElement;
      if (!parent) break;
      const index = Array.prototype.indexOf.call(parent.children || [], current);
      if (index < 0) break;
      const tag = current.tagName ? current.tagName.toLowerCase() : '*';
      segments.unshift(tag + ':nth-child(' + (index + 1) + ')');
      current = parent;
      if (segments.length >= 5) break;
    }
    return segments.length > 0 ? 'body ' + segments.join(' > ') : null;
  };
  const buildSelector = (element) => {
    if (!(element instanceof Element)) return null;
    const slot = element.getAttribute('data-leary-ppt-slot');
    if (slot) {
      const selector = '[data-leary-ppt-slot="' + attrEscape(slot) + '"]';
      if (isUniqueSelector(selector)) return selector;
    }
    const blockId = element.getAttribute('data-block-id');
    if (blockId) {
      const selector = '[data-block-id="' + attrEscape(blockId) + '"]';
      if (isUniqueSelector(selector)) return selector;
    }
    const id = element.getAttribute('id');
    if (id) {
      const selector = '#' + cssEscape(id);
      if (isUniqueSelector(selector)) return selector;
    }
    return buildNthChildSelector(element);
  };
  const isSelectable = (element) => {
    if (!(element instanceof HTMLElement)) return false;
    if (element.closest('script, style, link, meta, title')) return false;
    if (element === document.body || element === document.documentElement) return false;
    if (!element.matches(SELECTABLE_SELECTOR)) return false;
    const rect = element.getBoundingClientRect();
    return rect.width >= 2 && rect.height >= 2;
  };
  const findSelectable = (origin) => {
    let current = origin instanceof Element ? origin.closest(SELECTABLE_SELECTOR) : null;
    while (current && current !== document.body && current !== document.documentElement) {
      if (isSelectable(current) && buildSelector(current)) return current;
      current = current.parentElement;
    }
    return null;
  };
  const ensureStyle = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = \`
      html.leary-ppt-edit-enabled, html.leary-ppt-edit-enabled * { cursor: crosshair !important; }
      .\${HOVER_CLASS} { outline: 2px dashed rgba(14, 165, 233, 0.86) !important; outline-offset: 4px !important; }
      .\${SELECTED_CLASS} { outline: 3px solid rgba(15, 118, 110, 0.98) !important; outline-offset: 5px !important; box-shadow: 0 0 0 8px rgba(15, 118, 110, 0.16) !important; }
      #\${OVERLAY_ID} { position: fixed !important; z-index: 2147483647 !important; pointer-events: none !important; border: 1px solid rgba(15, 118, 110, 0.96) !important; box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.14) !important; box-sizing: border-box !important; }
      #\${SLOT_HINT_ID} { position: fixed !important; z-index: 2147483647 !important; pointer-events: none !important; padding: 6px 10px !important; border-radius: 999px !important; background: rgba(15, 23, 42, 0.88) !important; color: #f8fafc !important; font: 600 12px/1.2 sans-serif !important; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.18) !important; white-space: nowrap !important; transform: translate(-50%, calc(-100% - 12px)) !important; }
      #\${OVERLAY_ID} .\${HANDLE_CLASS} { position: absolute !important; width: 14px !important; height: 14px !important; border: 2px solid #fff !important; border-radius: 999px !important; background: #0f766e !important; box-shadow: 0 2px 8px rgba(0,0,0,0.24) !important; pointer-events: auto !important; box-sizing: border-box !important; }
      #\${OVERLAY_ID} .\${HANDLE_CLASS}[data-dir="n"] { left: calc(50% - 7px) !important; top: -8px !important; cursor: ns-resize !important; }
      #\${OVERLAY_ID} .\${HANDLE_CLASS}[data-dir="s"] { left: calc(50% - 7px) !important; bottom: -8px !important; cursor: ns-resize !important; }
      #\${OVERLAY_ID} .\${HANDLE_CLASS}[data-dir="w"] { left: -8px !important; top: calc(50% - 7px) !important; cursor: ew-resize !important; }
      #\${OVERLAY_ID} .\${HANDLE_CLASS}[data-dir="e"] { right: -8px !important; top: calc(50% - 7px) !important; cursor: ew-resize !important; }
      #\${OVERLAY_ID} .\${HANDLE_CLASS}[data-dir="nw"] { left: -8px !important; top: -8px !important; cursor: nwse-resize !important; }
      #\${OVERLAY_ID} .\${HANDLE_CLASS}[data-dir="ne"] { right: -8px !important; top: -8px !important; cursor: nesw-resize !important; }
      #\${OVERLAY_ID} .\${HANDLE_CLASS}[data-dir="sw"] { left: -8px !important; bottom: -8px !important; cursor: nesw-resize !important; }
      #\${OVERLAY_ID} .\${HANDLE_CLASS}[data-dir="se"] { right: -8px !important; bottom: -8px !important; cursor: nwse-resize !important; }
    \`;
    document.head.appendChild(style);
  };
  const clearHover = () => {
    if (hoverElement && hoverElement !== selectedElement) hoverElement.classList.remove(HOVER_CLASS);
    hoverElement = null;
    if (slotHintElement) {
      slotHintElement.remove();
      slotHintElement = null;
    }
  };
  const readSlotLabel = (element) => {
    if (!(element instanceof HTMLElement)) return '';
    return normalizeText(element.getAttribute('data-leary-ppt-slot') || element.getAttribute('data-block-id') || '');
  };
  const ensureSlotHint = () => {
    if (slotHintElement && slotHintElement.isConnected) return slotHintElement;
    const hint = document.createElement('div');
    hint.id = SLOT_HINT_ID;
    document.body.appendChild(hint);
    slotHintElement = hint;
    return slotHintElement;
  };
  const updateSlotHint = (element) => {
    const label = readSlotLabel(element);
    if (!label) {
      if (slotHintElement) {
        slotHintElement.remove();
        slotHintElement = null;
      }
      return;
    }
    const hint = ensureSlotHint();
    const rect = element.getBoundingClientRect();
    hint.textContent = label;
    hint.style.left = (rect.left + rect.width / 2).toFixed(1) + 'px';
    hint.style.top = rect.top.toFixed(1) + 'px';
  };
  const setHover = (element) => {
    if (hoverElement === element) return;
    ensureStyle();
    clearHover();
    hoverElement = element;
    if (hoverElement && hoverElement !== selectedElement) {
      hoverElement.classList.add(HOVER_CLASS);
      updateSlotHint(hoverElement);
    }
  };
  const ensureOverlay = () => {
    if (overlayElement && overlayElement.isConnected) return overlayElement;
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    ['n', 's', 'w', 'e', 'nw', 'ne', 'sw', 'se'].forEach((dir) => {
      const handle = document.createElement('div');
      handle.className = HANDLE_CLASS;
      handle.dataset.dir = dir;
      overlay.appendChild(handle);
    });
    document.body.appendChild(overlay);
    overlayElement = overlay;
    return overlayElement;
  };
  const clearOverlay = () => {
    if (overlayElement) overlayElement.remove();
    overlayElement = null;
  };
  const updateOverlay = () => {
    if (!selectedElement) {
      clearOverlay();
      return;
    }
    const overlay = ensureOverlay();
    const rect = selectedElement.getBoundingClientRect();
    overlay.style.left = rect.left.toFixed(1) + 'px';
    overlay.style.top = rect.top.toFixed(1) + 'px';
    overlay.style.width = Math.max(1, rect.width).toFixed(1) + 'px';
    overlay.style.height = Math.max(1, rect.height).toFixed(1) + 'px';
  };
  const toRect = (rect) => ({
    x: Math.round(rect.left * 10) / 10,
    y: Math.round(rect.top * 10) / 10,
    width: Math.round(rect.width * 10) / 10,
    height: Math.round(rect.height * 10) / 10,
  });
  const snapshotElement = (element, selector) => {
    const computed = window.getComputedStyle(element);
    const textStyleSource = findTextStyleSource(element);
    const textComputed = window.getComputedStyle(textStyleSource);
    const rect = element.getBoundingClientRect();
    return {
      selector,
      tagName: element.tagName.toLowerCase(),
      text: normalizeText(element.textContent),
      rect: toRect(rect),
      style: {
        color: textComputed.color || computed.color || '',
        fontSize: textComputed.fontSize || computed.fontSize || '',
        fontWeight: textComputed.fontWeight || computed.fontWeight || '',
        backgroundColor: computed.backgroundColor || '',
        opacity: computed.opacity || '',
        zIndex: computed.zIndex === 'auto' ? '' : computed.zIndex,
        left: computed.left === 'auto' ? '' : computed.left,
        top: computed.top === 'auto' ? '' : computed.top,
        width: Math.round(rect.width * 10) / 10 + 'px',
        height: Math.round(rect.height * 10) / 10 + 'px',
      },
    };
  };
  const postSelection = (selection) => {
    window.parent.postMessage({
      type: EVENT_TYPE,
      event: 'selection-changed',
      payload: { selection },
    }, '*');
  };
  const postHtmlChanged = () => {
    window.parent.postMessage({
      type: EVENT_TYPE,
      event: 'html-changed',
      payload: { html: '<!doctype html>\\n' + document.documentElement.outerHTML },
    }, '*');
  };
  const postPatchApplied = (patch) => {
    window.parent.postMessage({
      type: EVENT_TYPE,
      event: 'patch-applied',
      payload: { patch },
    }, '*');
  };
  const postUndoRequest = () => {
    window.parent.postMessage({
      type: EVENT_TYPE,
      event: 'undo-request',
      payload: {},
    }, '*');
  };
  const setSelected = (element) => {
    if (selectedElement) selectedElement.classList.remove(SELECTED_CLASS);
    selectedElement = element;
    if (!selectedElement) {
      clearOverlay();
      postSelection(null);
      return;
    }
    selectedElement.classList.remove(HOVER_CLASS);
    selectedElement.classList.add(SELECTED_CLASS);
    const selector = buildSelector(selectedElement);
    if (!selector) return;
    updateOverlay();
    postSelection(snapshotElement(selectedElement, selector));
  };
  const parsePx = (value) => {
    const parsed = Number.parseFloat(String(value || '0'));
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const ensureAbsoluteLayout = (element) => {
    const computed = window.getComputedStyle(element);
    if (computed.position === 'absolute' || computed.position === 'fixed') {
      return;
    }
    const rect = element.getBoundingClientRect();
    element.style.setProperty('position', 'absolute', 'important');
    void element.offsetTop;
    const offsetParent = element.offsetParent;
    const offsetRect = offsetParent instanceof Element
      ? offsetParent.getBoundingClientRect()
      : { left: 0, top: 0 };
    element.style.setProperty('left', (rect.left - offsetRect.left).toFixed(1) + 'px', 'important');
    element.style.setProperty('top', (rect.top - offsetRect.top).toFixed(1) + 'px', 'important');
    element.style.setProperty('width', Math.max(1, rect.width).toFixed(1) + 'px', 'important');
    element.style.setProperty('height', Math.max(1, rect.height).toFixed(1) + 'px', 'important');
  };
  const getLayoutPatch = (element, selector) => ({
    selector,
    style: {
      left: element.style.left || '',
      top: element.style.top || '',
      width: element.style.width || '',
      height: element.style.height || '',
    },
  });
  const stylePropertyByField = {
    color: 'color',
    fontSize: 'font-size',
    fontWeight: 'font-weight',
    backgroundColor: 'background-color',
    opacity: 'opacity',
    zIndex: 'z-index',
    left: 'left',
    top: 'top',
    width: 'width',
    height: 'height',
  };
  const textStyleFieldByProperty = {
    color: 'color',
    'font-size': 'fontSize',
    'font-weight': 'fontWeight',
  };
  const snapshotTextStyleTargets = (element, propertyName) => collectTextStyleTargets(element).map((target, index) => ({
    index,
    value: target.style.getPropertyValue(propertyName),
  }));
  const buildInversePatch = (element, patch) => {
    const inverse = { selector: patch.selector };
    if (typeof patch.text === 'string') {
      inverse.text = element.textContent || '';
    }
    if (patch.style) {
      inverse.style = {};
      Object.keys(patch.style).forEach((field) => {
        const propertyName = stylePropertyByField[field];
        if (propertyName) {
          if (field === 'color' || field === 'fontSize' || field === 'fontWeight') {
            inverse.style[field] = readTextStyleValue(element, propertyName);
            const textTargets = snapshotTextStyleTargets(element, propertyName);
            if (textTargets.length > 0) {
              inverse.textStyleTargets = inverse.textStyleTargets || {};
              inverse.textStyleTargets[field] = textTargets;
            }
            return;
          }
          inverse.style[field] = element.style.getPropertyValue(propertyName);
        }
      });
    }
    return inverse;
  };
  const pushUndo = (patch) => {
    const element = patch && typeof patch.selector === 'string' ? document.querySelector(patch.selector) : null;
    if (!(element instanceof HTMLElement)) return;
    undoStack.push(buildInversePatch(element, patch));
    if (undoStack.length > 80) undoStack.shift();
  };
  const applyStyleValue = (element, name, value) => {
    if (value === undefined) return;
    const normalized = String(value).trim();
    if (!normalized) {
      element.style.removeProperty(name);
      return;
    }
    element.style.setProperty(name, normalized, 'important');
  };
  const applyTextStyleValue = (element, name, value, textTargetValues) => {
    if (value === undefined) return;
    const normalized = String(value).trim();
    const targets = collectTextStyleTargets(element);
    if (targets.length === 0) return;
    const fieldName = textStyleFieldByProperty[name];
    const targetValues = fieldName && textTargetValues ? textTargetValues[fieldName] : null;
    targets.forEach((target, index) => {
      const nextValue = targetValues
        ? String(targetValues.find((entry) => entry.index === index)?.value || '').trim()
        : normalized;
      if (targetValues) {
        if (!nextValue) {
          target.style.removeProperty(name);
          return;
        }
        target.style.setProperty(name, nextValue, 'important');
        return;
      }
      if (!normalized) {
        target.style.removeProperty(name);
        return;
      }
      target.style.setProperty(name, normalized, 'important');
    });
  };
  const mayAffectChartLayout = (element) => {
    if (!(element instanceof HTMLElement)) return false;
    const blockId = String(element.getAttribute('data-block-id') || '').toLowerCase();
    return /chart|graph|plot/.test(blockId)
      || Boolean(element.querySelector('canvas, .ppt-chart-frame'))
      || Boolean(element.closest('[data-block-id*="chart"], [data-block-id*="graph"], [data-block-id*="plot"]'));
  };
  const scheduleChartRefresh = (element) => {
    if (!mayAffectChartLayout(element)) return;
    const runtime = window.PPT;
    if (!runtime || typeof runtime.resizeCharts !== 'function') return;
    window.requestAnimationFrame(() => {
      try {
        runtime.resizeCharts(element);
      } catch (_error) {
        try {
          runtime.resizeCharts();
        } catch (_nestedError) {}
      }
    });
  };
  const applyPatch = (patch, options) => {
    if (!patch || typeof patch.selector !== 'string') return;
    const element = document.querySelector(patch.selector);
    if (!(element instanceof HTMLElement)) return;
    if (options?.recordUndo !== false && !managedUndo) {
      pushUndo(patch);
    }
    if (typeof patch.text === 'string') {
      applyTextContentPreservingMarkup(element, patch.text);
    }
    if (patch.style) {
      applyTextStyleValue(element, 'color', patch.style.color, patch.textStyleTargets);
      applyTextStyleValue(element, 'font-size', patch.style.fontSize, patch.textStyleTargets);
      applyTextStyleValue(element, 'font-weight', patch.style.fontWeight, patch.textStyleTargets);
      applyStyleValue(element, 'background-color', patch.style.backgroundColor);
      applyStyleValue(element, 'opacity', patch.style.opacity);
      applyStyleValue(element, 'z-index', patch.style.zIndex);
      applyStyleValue(element, 'left', patch.style.left);
      applyStyleValue(element, 'top', patch.style.top);
      applyStyleValue(element, 'width', patch.style.width);
      applyStyleValue(element, 'height', patch.style.height);
      if ((patch.style.left !== undefined || patch.style.top !== undefined) && !element.style.position) {
        element.style.setProperty('position', 'absolute', 'important');
      }
    }
    scheduleChartRefresh(element);
    setSelected(element);
    updateOverlay();
    postHtmlChanged();
  };
  const undoLocal = () => {
    const inversePatch = undoStack.pop();
    if (!inversePatch) return;
    applyPatch(inversePatch, { recordUndo: false });
  };
  const setEnabled = (nextEnabled) => {
    enabled = Boolean(nextEnabled);
    document.documentElement.classList.toggle('leary-ppt-edit-enabled', enabled);
    if (enabled) {
      ensureStyle();
      return;
    }
    clearHover();
    setSelected(null);
  };
  const handlePointerDown = (event) => {
    if (!enabled || event.button !== 0) return;
    const handle = event.target instanceof Element ? event.target.closest('.' + HANDLE_CLASS) : null;
    const target = handle && selectedElement
      ? selectedElement
      : findSelectable(event.target);
    if (!target) return;
    if (target !== selectedElement) {
      setSelected(target);
    }
    const selector = buildSelector(target);
    if (!selector) return;
    ensureAbsoluteLayout(target);
    const rect = target.getBoundingClientRect();
    manipulationState = {
      target,
      selector,
      dir: handle ? handle.getAttribute('data-dir') || 'se' : 'move',
      startClientX: event.clientX,
      startClientY: event.clientY,
      baseLeft: parsePx(target.style.left),
      baseTop: parsePx(target.style.top),
      baseWidth: Math.max(1, rect.width),
      baseHeight: Math.max(1, rect.height),
    };
    didManipulate = false;
    try { event.target.setPointerCapture?.(event.pointerId); } catch (_error) {}
    event.preventDefault();
    event.stopPropagation();
  };
  const handlePointerMove = (event) => {
    if (!enabled) return;
    if (manipulationState) {
      const state = manipulationState;
      const dx = event.clientX - state.startClientX;
      const dy = event.clientY - state.startClientY;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        didManipulate = true;
      }
      let nextLeft = state.baseLeft;
      let nextTop = state.baseTop;
      let nextWidth = state.baseWidth;
      let nextHeight = state.baseHeight;
      if (state.dir === 'move') {
        nextLeft += dx;
        nextTop += dy;
      } else {
        if (state.dir.includes('e')) nextWidth = Math.max(1, state.baseWidth + dx);
        if (state.dir.includes('s')) nextHeight = Math.max(1, state.baseHeight + dy);
        if (state.dir.includes('w')) {
          nextWidth = Math.max(1, state.baseWidth - dx);
          nextLeft += state.baseWidth - nextWidth;
        }
        if (state.dir.includes('n')) {
          nextHeight = Math.max(1, state.baseHeight - dy);
          nextTop += state.baseHeight - nextHeight;
        }
      }
      state.target.style.setProperty('left', nextLeft.toFixed(1) + 'px', 'important');
      state.target.style.setProperty('top', nextTop.toFixed(1) + 'px', 'important');
      state.target.style.setProperty('width', nextWidth.toFixed(1) + 'px', 'important');
      state.target.style.setProperty('height', nextHeight.toFixed(1) + 'px', 'important');
      updateOverlay();
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    setHover(findSelectable(event.target));
  };
  const handlePointerUp = (event) => {
    if (!manipulationState) return;
    const state = manipulationState;
    manipulationState = null;
    try { event.target.releasePointerCapture?.(event.pointerId); } catch (_error) {}
    if (didManipulate) {
      suppressNextClick = true;
      if (!managedUndo) {
        undoStack.push({
          selector: state.selector,
          style: {
            left: state.baseLeft.toFixed(1) + 'px',
            top: state.baseTop.toFixed(1) + 'px',
            width: state.baseWidth.toFixed(1) + 'px',
            height: state.baseHeight.toFixed(1) + 'px',
          },
        });
      }
      const patch = getLayoutPatch(state.target, state.selector);
      scheduleChartRefresh(state.target);
      postPatchApplied(patch);
      setSelected(state.target);
      postHtmlChanged();
    }
    event.preventDefault();
    event.stopPropagation();
  };
  const handleClick = (event) => {
    if (!enabled) return;
    if (suppressNextClick) {
      suppressNextClick = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (didManipulate) {
      didManipulate = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const overlayTarget = event.target instanceof HTMLElement ? event.target.closest('#' + OVERLAY_ID) : null;
    if (overlayTarget) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  const handleKeydown = (event) => {
    if (enabled && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      event.stopPropagation();
      if (managedUndo) {
        postUndoRequest();
      } else {
        undoLocal();
      }
      return;
    }
    if (!enabled || event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    setEnabled(false);
  };
  const handleMessage = (event) => {
    const message = event.data || {};
    if (message.type !== COMMAND_TYPE) return;
    if (message.command === 'set-mode') {
      managedUndo = Boolean(message.payload && message.payload.managedUndo);
      setEnabled(Boolean(message.payload && message.payload.enabled));
    }
    if (message.command === 'clear-selection') setSelected(null);
    if (message.command === 'apply-patch') applyPatch(message.payload && message.payload.patch);
    if (message.command === 'undo') undoLocal();
  };
  window.addEventListener('message', handleMessage);
  document.addEventListener('pointerdown', handlePointerDown, true);
  document.addEventListener('pointermove', handlePointerMove, true);
  document.addEventListener('pointerup', handlePointerUp, true);
  document.addEventListener('pointercancel', handlePointerUp, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', handleKeydown, true);
})();
`;
