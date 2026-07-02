// CitationMarkdown.test.tsx 负责验证引用标签渲染不会被 TeX 定界符预处理误伤。
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import CitationMarkdown from '../CitationMarkdown';

describe('CitationMarkdown', () => {
  it('会将外层括号包裹的两段式引用渲染为 citation tag，而不是数学公式', () => {
    const html = renderToStaticMarkup(
      <CitationMarkdown text={'安全系统的概念：安全系统是以人为中心。(\\[b3421bf1f28c4d7490678aa336b52d8b]\\[4])'} />
    );

    expect(html).toContain('P4');
    expect(html).toContain('文档');
    expect(html).not.toContain('katex');
    expect(html).not.toContain('b3421bf1f28c4d7490678aa336b52d8b]\\[4');
  });

  it('会在列表场景中正确渲染矩阵块公式而不出现 katex-error', () => {
    const html = renderToStaticMarkup(
      <CitationMarkdown
        text={
          '4. **单因素模糊评判** -> 构建**评判矩阵**：\n\n' +
          '$$R = \\begin{bmatrix}\n' +
          'r_{11} & r_{12} & \\cdots & r_{1n} \\\\\n' +
          'r_{21} & r_{22} & \\cdots & r_{2n} \\\\\n' +
          '\\vdots & \\vdots & \\ddots & \\vdots \\\\\n' +
          'r_{m1} & r_{m2} & \\cdots & r_{mn}\n' +
          '\\end{bmatrix}$$\n\n' +
          '5. **模糊综合决策**：$B = A \\circ R$。'
        }
      />
    );

    expect(html).toContain('katex-display');
    expect(html).not.toContain('katex-error');
  });

  it('支持单美元符号包裹的行内公式', () => {
    const html = renderToStaticMarkup(<CitationMarkdown text={'结果为 $R_{k \\cdot T}$。'} />);

    expect(html).toContain('katex');
    expect(html).not.toContain('$R_{k \\cdot T}$');
  });
});
