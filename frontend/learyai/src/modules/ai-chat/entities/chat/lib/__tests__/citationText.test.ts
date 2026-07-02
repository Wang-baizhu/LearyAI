// citationText.test.ts 负责验证 docId + pages 引用格式的文档名替换结果。
import { describe, expect, it } from 'vitest';
import { replaceCitationDocId } from '../citationText';

describe('replaceCitationDocId', () => {
  it('会把新格式引用替换成文档名与页码', () => {
    expect(replaceCitationDocId('参考([doc-1][12])', { 'doc-1': '需求文档' })).toBe(
      '参考需求文档12页'
    );
  });

  it('会把多页引用替换成文档名与多个页码', () => {
    expect(
      replaceCitationDocId('先声明([doc-1][8][10-11])', { 'doc-1': '需求文档' })
    ).toBe('先声明需求文档8、10-11页');
  });
});
