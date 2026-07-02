// @vitest-environment jsdom
// 职责: 验证 PPT 编辑运行时会读取真实文本样式、把文本样式写入真实文本节点，并正确回放多 span undo。
import { describe, expect, it } from 'vitest';
import { buildPptEditRuntimeScript } from './pptEditRuntime';

describe('buildPptEditRuntimeScript', () => {
  it('reads text styles from the actual rich-text node for selection snapshots', () => {
    const script = buildPptEditRuntimeScript({
      commandType: 'leary:test:command',
      eventType: 'leary:test:event',
    });

    expect(script).toContain('const findTextStyleSource = (root) => {');
    expect(script).toContain('const textComputed = window.getComputedStyle(textStyleSource);');
    expect(script).toContain("color: textComputed.color || computed.color || ''");
    expect(script).toContain("fontSize: textComputed.fontSize || computed.fontSize || ''");
    expect(script).toContain("fontWeight: textComputed.fontWeight || computed.fontWeight || ''");
  });

  it('applies text style patches to actual text nodes instead of only the outer slot', () => {
    const script = buildPptEditRuntimeScript({
      commandType: 'leary:test:command',
      eventType: 'leary:test:event',
    });

    expect(script).toContain('const collectTextStyleTargets = (root) => {');
    expect(script).toContain('const applyTextContentPreservingMarkup = (element, value) => {');
    expect(script).toContain("const applyTextStyleValue = (element, name, value, textTargetValues) => {");
    expect(script).toContain("applyTextStyleValue(element, 'color', patch.style.color, patch.textStyleTargets);");
    expect(script).toContain("applyTextStyleValue(element, 'font-size', patch.style.fontSize, patch.textStyleTargets);");
    expect(script).toContain("applyTextStyleValue(element, 'font-weight', patch.style.fontWeight, patch.textStyleTargets);");
  });

  it('captures per-span text styles for undo patches', () => {
    const script = buildPptEditRuntimeScript({
      commandType: 'leary:test:command',
      eventType: 'leary:test:event',
    });

    expect(script).toContain('const snapshotTextStyleTargets = (element, propertyName) => collectTextStyleTargets(element).map((target, index) => ({');
    expect(script).toContain('inverse.textStyleTargets = inverse.textStyleTargets || {};');
    expect(script).toContain('inverse.textStyleTargets[field] = textTargets;');
  });

  it('restores per-span text styles when undoing a rich-text patch', () => {
    const commandType = 'leary:test:command';
    const script = buildPptEditRuntimeScript({
      commandType,
      eventType: 'leary:test:event',
    });

    document.body.innerHTML = `
      <div id="slot" data-block-id="title">
        <span style="color: rgb(255, 0, 0); font-size: 24px; font-weight: 700;">标题</span>
        <span style="color: rgb(0, 0, 255); font-size: 16px; font-weight: 400;">副标题</span>
      </div>
    `;
    Object.defineProperty(window, 'parent', {
      configurable: true,
      value: window,
    });

    window.eval(script);

    window.dispatchEvent(new MessageEvent('message', {
      data: {
        type: commandType,
        command: 'apply-patch',
        payload: {
          patch: {
            selector: '#slot',
            style: {
              color: '#00ff00',
              fontSize: '20px',
              fontWeight: '500',
            },
          },
        },
      },
    }));

    const spansAfterPatch = [...document.querySelectorAll<HTMLElement>('#slot span')];
    expect(spansAfterPatch[0].style.color).toBe('rgb(0, 255, 0)');
    expect(spansAfterPatch[1].style.color).toBe('rgb(0, 255, 0)');
    expect(spansAfterPatch[0].style.fontSize).toBe('20px');
    expect(spansAfterPatch[1].style.fontSize).toBe('20px');

    window.dispatchEvent(new MessageEvent('message', {
      data: {
        type: commandType,
        command: 'undo',
      },
    }));

    const spansAfterUndo = [...document.querySelectorAll<HTMLElement>('#slot span')];
    expect(spansAfterUndo[0].style.color).toBe('rgb(255, 0, 0)');
    expect(spansAfterUndo[1].style.color).toBe('rgb(0, 0, 255)');
    expect(spansAfterUndo[0].style.fontSize).toBe('24px');
    expect(spansAfterUndo[1].style.fontSize).toBe('16px');
    expect(spansAfterUndo[0].style.fontWeight).toBe('700');
    expect(spansAfterUndo[1].style.fontWeight).toBe('400');
  });

  it('preserves inner rich-text styles when applying text patches', () => {
    const commandType = 'leary:test:command';
    const script = buildPptEditRuntimeScript({
      commandType,
      eventType: 'leary:test:event',
    });

    document.body.innerHTML = `
      <div id="slot" data-block-id="title">
        <span style="color: rgb(255, 0, 0);">主标题</span><span style="color: rgb(0, 0, 255);">副标题</span>
      </div>
    `;
    Object.defineProperty(window, 'parent', {
      configurable: true,
      value: window,
    });

    window.eval(script);

    window.dispatchEvent(new MessageEvent('message', {
      data: {
        type: commandType,
        command: 'apply-patch',
        payload: {
          patch: {
            selector: '#slot',
            text: '新的标题',
          },
        },
      },
    }));

    const spansAfterPatch = [...document.querySelectorAll<HTMLElement>('#slot span')];
    expect(spansAfterPatch).toHaveLength(2);
    expect(spansAfterPatch[0]?.style.color).toBe('rgb(255, 0, 0)');
    expect(spansAfterPatch[1]?.style.color).toBe('rgb(0, 0, 255)');
    expect(document.querySelector<HTMLElement>('#slot')?.textContent).toBe('新的标题');
  });
});
