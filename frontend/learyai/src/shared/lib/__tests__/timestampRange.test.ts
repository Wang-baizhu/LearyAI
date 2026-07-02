// timestampRange.test.ts 负责验证时间戳区间解析工具的行为。
import { describe, expect, it } from 'vitest';
import { findTimestampRanges, parseTimestampToSeconds } from '../timestampRange';

describe('timestampRange', () => {
  it('会把 HH:MM:SS 解析为秒数', () => {
    expect(parseTimestampToSeconds('00:00:07')).toBe(7);
    expect(parseTimestampToSeconds('01:02:03')).toBe(3723);
  });

  it('会拒绝非法时间格式', () => {
    expect(parseTimestampToSeconds('00:62:03')).toBeNull();
    expect(parseTimestampToSeconds('1:02:03')).toBeNull();
    expect(parseTimestampToSeconds('hello')).toBeNull();
  });

  it('会识别文本中的时间戳区间并返回首个时间点秒数', () => {
    expect(
      findTimestampRanges('先看[00:00:07-00:00:10]，再看[00:01:15]')
    ).toEqual([
      {
        raw: '[00:00:07-00:00:10]',
        startLabel: '00:00:07',
        endLabel: '00:00:10',
        startSeconds: 7,
        endSeconds: 10,
        index: 2,
      },
      {
        raw: '[00:01:15]',
        startLabel: '00:01:15',
        endLabel: undefined,
        startSeconds: 75,
        endSeconds: undefined,
        index: 24,
      },
    ]);
  });
});
