// useTextStreamThrottle.test.ts 负责验证流式 Markdown 文本尾部缓冲策略。
import { describe, expect, it } from 'vitest';
import { splitStableMarkdownText } from '../useTextStreamThrottle';

describe('splitStableMarkdownText', () => {
  it('会缓存未闭合的 citation 尾部，避免提前落库', () => {
    expect(splitStableMarkdownText('正文([9204688cf3294cd9')).toEqual({
      flushable: '正文',
      pending: '([9204688cf3294cd9',
    });
  });

  it('会缓存未换行结束的表格尾行，等待下一帧补齐', () => {
    expect(splitStableMarkdownText('| 标题 | 页码范围 |\n|------|------|\n| 第1章 |')).toEqual({
      flushable: '| 标题 | 页码范围 |\n|------|------|\n',
      pending: '| 第1章 |',
    });
  });

  it('完整的 citation 和表格行会直接放行', () => {
    expect(
      splitStableMarkdownText('| 标题 | 页码范围 |\n|------|------|\n| 第1章 | 1-9 |\n([9204688cf3294cd9901af46fff645419][1-9])')
    ).toEqual({
      flushable:
        '| 标题 | 页码范围 |\n|------|------|\n| 第1章 | 1-9 |\n([9204688cf3294cd9901af46fff645419][1-9])',
      pending: '',
    });
  });
});
