// MarkdownRenderer.test.tsx 负责验证共享 Markdown 渲染器的公式与表格兼容性。
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import MarkdownRenderer from '../MarkdownRenderer';

describe('MarkdownRenderer', () => {
  it('支持 TeX 风格的块级公式分隔符', () => {
    const html = renderToStaticMarkup(
      <MarkdownRenderer text={'\\[\nI_g(i) = \\frac{\\partial Q}{\\partial q_i}\n\\]'} />
    );

    expect(html).toContain('katex');
    expect(html).not.toContain('\\[');
    expect(html).not.toContain('\\]');
  });

  it('支持 TeX 风格的行内公式分隔符', () => {
    const html = renderToStaticMarkup(<MarkdownRenderer text={'结果为 \\(a+b\\)'} />);

    expect(html).toContain('katex');
    expect(html).not.toContain('\\(');
    expect(html).not.toContain('\\)');
  });

  it('支持单美元符号包裹的行内公式', () => {
    const html = renderToStaticMarkup(<MarkdownRenderer text={'结果为 $R_{k \\cdot T}$'} />);

    expect(html).toContain('katex');
    expect(html).not.toContain('$R_{k \\cdot T}$');
  });

  it('会保留行内代码中的字面转义字符', () => {
    const html = renderToStaticMarkup(<MarkdownRenderer text={'`\\(`'} />);

    expect(html).toMatch(/<code[^>]*>\\\(<\/code>/);
    expect(html).not.toContain('katex');
  });

  it('会在混合格式段落中继续解析纯文本兄弟节点里的 TeX', () => {
    const html = renderToStaticMarkup(
      <MarkdownRenderer text={'前缀 \\(a+b\\) **强调** 后缀'} />
    );

    expect(html).toContain('katex');
    expect(html).toContain('强调</span>');
    expect(html).not.toContain('\\(a+b\\)');
  });

  it('会在混合格式段落中继续解析块级 TeX 分隔符', () => {
    const html = renderToStaticMarkup(
      <MarkdownRenderer text={'前缀 \\[a+b\\] **强调** 后缀'} />
    );

    expect(html).toContain('katex-display');
    expect(html).toContain('强调</span>');
    expect(html).not.toContain('\\[a+b\\]');
  });

  it('支持多行矩阵块级公式', () => {
    const html = renderToStaticMarkup(
      <MarkdownRenderer
        text={
          '\\[\n\\begin{bmatrix}\nr_{11} & r_{12} & \\cdots & r_{1n} \\\\\n' +
          'r_{21} & r_{22} & \\cdots & r_{2n} \\\\\n' +
          '\\vdots & \\vdots & \\ddots & \\vdots \\\\\n' +
          'r_{m1} & r_{m2} & \\cdots & r_{mn}\n\\end{bmatrix}\n\\]'
        }
      />
    );

    expect(html).toContain('katex-display');
    expect(html).not.toContain('<p>\\begin{bmatrix}');
    expect(html).not.toContain('<p>[\n');
  });

  it('会修复缺少矩阵环境的裸矩阵行', () => {
    const html = renderToStaticMarkup(
      <MarkdownRenderer
        text={
          '\\[\n' +
          'r_{11} & r_{12} & \\cdots & r_{1n} \\\\\n' +
          'r_{21} & r_{22} & \\cdots & r_{2n} \\\\\n' +
          '\\vdots & \\vdots & \\ddots & \\vdots\n' +
          '\\]'
        }
      />
    );

    expect(html).toContain('katex-display');
    expect(html).not.toContain('katex-error');
  });

  it('会将合法的 GFM 表格渲染为 table 元素', () => {
    const html = renderToStaticMarkup(
      <MarkdownRenderer
        text={'| 分类 | 页码 | 说明 |\n|------|------|------|\n| 第1类 | 1-2 | 核心词汇 |'}
      />
    );

    expect(html).toContain('<table>');
    expect(html).toContain('>分类</th>');
    expect(html).toContain('>核心词汇</td>');
  });

  it('不会把含空单元格的合法表格误修复成错位列', () => {
    const html = renderToStaticMarkup(
      <MarkdownRenderer text={'| A | B | C |\n| --- | --- | --- |\n| 1 |  | 3 |'} />
    );

    expect(html).toContain('<table>');
    expect(html).toMatch(/<thead[^>]*>[\s\S]*?<th[^>]*>A<\/th><th[^>]*>B<\/th><th[^>]*>C<\/th>[\s\S]*?<\/thead>/);
    expect(html).toMatch(/<tbody[^>]*>[\s\S]*?<td[^>]*>1<\/td><td[^>]*><\/td><td[^>]*>3<\/td>[\s\S]*?<\/tbody>/);
  });

  it('会修复流式阶段粘连在一起的表头、分隔线和数据行', () => {
    const html = renderToStaticMarkup(
      <MarkdownRenderer
        text={'| 文档名称 | 内容概要 ||--------|--------|| 安全系统工程导论 | 研究对象与研究内容 |'}
      />
    );

    expect(html).toContain('<table>');
    expect(html).toContain('>文档名称</th>');
    expect(html).toContain('>安全系统工程导论</td>');
  });

  it('会修复被压成单段文本的流式表格行边界', () => {
    const html = renderToStaticMarkup(
      <MarkdownRenderer
        text={
          '好的，我来生成一个简单的表格。\n\n' +
          '| 项目 | 数量 | 备注 | | :--- | :--- | :--- | | 苹果 | 3 | 红富士 | | 香蕉 | 5 | 进口 |'
        }
      />
    );

    expect(html).toContain('<table>');
    expect(html).toContain('>项目</th>');
    expect(html).toContain('>苹果</td>');
    expect(html).toContain('>红富士</td>');
  });

  it('会修复分隔线残缺的两列表格流式文本', () => {
    const html = renderToStaticMarkup(
      <MarkdownRenderer
        text={
          '| 项目 | 内容 ||------|| 文档名称 | 安全评价知识点总结（对照教材第29页） || 来源 | 《安全系统工程学（第3版）》第4章 |'
        }
      />
    );

    expect(html).toContain('<table>');
    expect(html).toContain('>项目</th>');
    expect(html).toContain('>文档名称</td>');
    expect(html).toContain('>《安全系统工程学（第3版）》第4章</td>');
  });

  it('会保留流式压扁表格里的空单元格位置', () => {
    const html = renderToStaticMarkup(
      <MarkdownRenderer text={'| A | B | C || --- | --- | --- || 1 |  | 3 |'} />
    );

    expect(html).toContain('<table>');
    expect(html).toMatch(/<thead[^>]*>[\s\S]*?<th[^>]*>A<\/th><th[^>]*>B<\/th><th[^>]*>C<\/th>[\s\S]*?<\/thead>/);
    expect(html).toMatch(/<tbody[^>]*>[\s\S]*?<td[^>]*>1<\/td><td[^>]*><\/td><td[^>]*>3<\/td>[\s\S]*?<\/tbody>/);
  });

  it('不会把代码块中的表格字面量误改成真实表格', () => {
    const html = renderToStaticMarkup(
      <MarkdownRenderer text={'```text\nconst schema = "| a | b || --- | --- || c | d |";\n```'} />
    );

    expect(html).toContain('markdown-renderer__code-pre');
    expect(html).toContain('&quot;| a | b || --- | --- || c | d |&quot;');
    expect(html).not.toContain('<table>');
  });

  it('不会改写行内代码里的表格分隔符字面量', () => {
    const html = renderToStaticMarkup(
      <MarkdownRenderer text={'请保持 `| a | b || --- | --- || c | d |` 原样输出'} />
    );

    expect(html).toMatch(/<code[^>]*>\| a \| b \|\| --- \| --- \|\| c \| d \|<\/code>/);
    expect(html).not.toContain('<table>');
  });
});
