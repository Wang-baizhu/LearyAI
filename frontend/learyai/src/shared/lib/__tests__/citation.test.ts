// citation.test.ts 负责验证 docId + pages 引用格式的解析行为。
import { describe, expect, it } from 'vitest';
import { parseCitationGroupRaw, parseCitationRaw, splitTextByCitations } from '../citation';

describe('citation', () => {
  it('会解析两段式引用格式', () => {
    expect(parseCitationRaw('([67cc70b75c604b3883b8][fa2309145675])')).toEqual({
      label: '67cc70b75c604b3883b8',
      type: '67cc70b75c604b3883b8',
      page: 'fa2309145675',
      pages: ['fa2309145675'],
      raw: '([67cc70b75c604b3883b8][fa2309145675])',
    });
  });

  it('会解析卡片 memory 中被转义后的两段式引用格式', () => {
    expect(parseCitationRaw('(\\[67cc70b75c604b3883b8]\\[fa2309145675])')).toEqual({
      label: '67cc70b75c604b3883b8',
      type: '67cc70b75c604b3883b8',
      page: 'fa2309145675',
      pages: ['fa2309145675'],
      raw: '(\\[67cc70b75c604b3883b8]\\[fa2309145675])',
    });
  });

  it('会在正文中切分出被转义后的引用片段', () => {
    expect(splitTextByCitations('整体具备新特定功能 (\\[67cc70b75c604b3883b8]\\[fa2309145675])')).toEqual([
      { kind: 'text', value: '整体具备新特定功能 ' },
      {
        kind: 'citation',
        value: {
          label: '67cc70b75c604b3883b8',
          type: '67cc70b75c604b3883b8',
          page: 'fa2309145675',
          pages: ['fa2309145675'],
          raw: '(\\[67cc70b75c604b3883b8]\\[fa2309145675])',
        },
      },
    ]);
  });

  it('会解析使用全角括号包裹的两段式引用格式', () => {
    expect(parseCitationRaw('（[910d98b4c0d444d6adcff0c4a98fde86][214]）')).toEqual({
      label: '910d98b4c0d444d6adcff0c4a98fde86',
      type: '910d98b4c0d444d6adcff0c4a98fde86',
      page: '214',
      pages: ['214'],
      raw: '（[910d98b4c0d444d6adcff0c4a98fde86][214]）',
    });
  });

  it('会在正文中切分出使用全角括号包裹的引用片段', () => {
    expect(
      splitTextByCitations(
        '确保他们能够胜任职业卫生服务、生产环境监测、健康监护、危害控制咨询等职责（[910d98b4c0d444d6adcff0c4a98fde86][214]）。'
      )
    ).toEqual([
      { kind: 'text', value: '确保他们能够胜任职业卫生服务、生产环境监测、健康监护、危害控制咨询等职责' },
      {
        kind: 'citation',
        value: {
          label: '910d98b4c0d444d6adcff0c4a98fde86',
          type: '910d98b4c0d444d6adcff0c4a98fde86',
          page: '214',
          pages: ['214'],
          raw: '（[910d98b4c0d444d6adcff0c4a98fde86][214]）',
        },
      },
      { kind: 'text', value: '。' },
    ]);
  });

  it('会把一个 docId 后面的多个 page 解析成单个 citation 的 pages 列表', () => {
    expect(parseCitationGroupRaw('([c57d44cec95cba6f9a703cfcd][11][70])')).toEqual({
      label: 'c57d44cec95cba6f9a703cfcd',
      type: 'c57d44cec95cba6f9a703cfcd',
      page: '11',
      pages: ['11', '70'],
      raw: '([c57d44cec95cba6f9a703cfcd][11][70])',
    });
  });

  it('会在正文中切分出一个含多个 page 的 citation 片段', () => {
    expect(splitTextByCitations('参考资料([c57d44cec95cba6f9a703cfcd][11][70][8-9])')).toEqual([
      { kind: 'text', value: '参考资料' },
      {
        kind: 'citation',
        value: {
          label: 'c57d44cec95cba6f9a703cfcd',
          type: 'c57d44cec95cba6f9a703cfcd',
          page: '11',
          pages: ['11', '70', '8-9'],
          raw: '([c57d44cec95cba6f9a703cfcd][11][70][8-9])',
        },
      },
    ]);
  });
});
