// @vitest-environment jsdom
// 职责: 验证 PPT HTML patch 会把文本样式写入实际富文本节点。
import { describe, expect, it } from 'vitest';
import { applyPptEditPatchToHtml } from './pptEditProtocol';

describe('applyPptEditPatchToHtml', () => {
  it('applies text color to nested rich-text nodes instead of only the outer slot', () => {
    const html = `<!doctype html>
<html>
  <body>
    <section data-leary-ppt-slot="title">
      <span style="color: rgb(255, 0, 0); font-size: 20px; font-weight: 700;">标题</span>
    </section>
  </body>
</html>`;

    const nextHtml = applyPptEditPatchToHtml(html, {
      selector: '[data-leary-ppt-slot="title"]',
      style: {
        color: '#00ff00',
        fontSize: '32px',
        fontWeight: '400',
      },
    });

    const doc = new DOMParser().parseFromString(nextHtml, 'text/html');
    const textNode = doc.querySelector('section span');
    expect(textNode?.getAttribute('style')).toContain('color: rgb(0, 255, 0)');
    expect(textNode?.getAttribute('style')).toContain('font-size: 32px');
    expect(textNode?.getAttribute('style')).toContain('font-weight: 400');
    expect(doc.querySelector('section')?.getAttribute('style') ?? '').not.toContain('color:');
  });

  it('removes text color from nested rich-text nodes when patch color is empty', () => {
    const html = `<!doctype html>
<html>
  <body>
    <section data-leary-ppt-slot="title">
      <span style="color: rgb(255, 0, 0);">标题</span>
    </section>
  </body>
</html>`;

    const nextHtml = applyPptEditPatchToHtml(html, {
      selector: '[data-leary-ppt-slot="title"]',
      style: {
        color: '',
      },
    });

    const doc = new DOMParser().parseFromString(nextHtml, 'text/html');
    expect(doc.querySelector('section span')?.getAttribute('style') ?? '').not.toContain('color:');
  });

  it('preserves alpha when applying semi-transparent colors', () => {
    const html = `<!doctype html>
<html>
  <body>
    <section data-leary-ppt-slot="title">
      <span>标题</span>
    </section>
  </body>
</html>`;

    const nextHtml = applyPptEditPatchToHtml(html, {
      selector: '[data-leary-ppt-slot="title"]',
      style: {
        color: 'rgba(0, 255, 0, 0.35)',
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
      },
    });

    const doc = new DOMParser().parseFromString(nextHtml, 'text/html');
    expect(doc.querySelector('section span')?.getAttribute('style')).toContain('rgba(0, 255, 0, 0.35)');
    expect(doc.querySelector('section')?.getAttribute('style')).toContain('rgba(15, 23, 42, 0.4)');
  });

  it('preserves rich-text markup styles when applying text patches', () => {
    const html = `<!doctype html>
<html>
  <body>
    <section data-leary-ppt-slot="title">
      <span style="color: rgb(255, 0, 0);">主标题</span><span style="color: rgb(0, 0, 255);">副标题</span>
    </section>
  </body>
</html>`;

    const nextHtml = applyPptEditPatchToHtml(html, {
      selector: '[data-leary-ppt-slot="title"]',
      text: '新的标题',
    });

    const doc = new DOMParser().parseFromString(nextHtml, 'text/html');
    const spans = [...doc.querySelectorAll<HTMLElement>('section span')];
    expect(spans).toHaveLength(2);
    expect(spans[0]?.style.color).toBe('rgb(255, 0, 0)');
    expect(spans[1]?.style.color).toBe('rgb(0, 0, 255)');
    expect(doc.querySelector('section')?.textContent).toBe('新的标题');
  });
});
