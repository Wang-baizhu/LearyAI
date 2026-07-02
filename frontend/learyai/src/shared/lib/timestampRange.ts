// timestampRange 负责解析详情预览中使用的时间戳区间文本。
export interface TimestampRangeMatch {
  raw: string;
  startLabel: string;
  endLabel?: string;
  startSeconds: number;
  endSeconds?: number;
  index: number;
}

const TIMESTAMP_SEGMENT_REGEX = /^\d{2}:\d{2}:\d{2}$/;
const TIMESTAMP_RANGE_REGEX = /\[(\d{2}:\d{2}:\d{2})(?:-(\d{2}:\d{2}:\d{2}))?\]/g;

export const parseTimestampToSeconds = (value: string): number | null => {
  const normalizedValue = value.trim();
  if (!TIMESTAMP_SEGMENT_REGEX.test(normalizedValue)) {
    return null;
  }

  const [hoursText, minutesText, secondsText] = normalizedValue.split(':');
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  const seconds = Number(secondsText);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || !Number.isInteger(seconds)) {
    return null;
  }
  if (minutes >= 60 || seconds >= 60) {
    return null;
  }

  return (hours * 60 * 60) + (minutes * 60) + seconds;
};

export const findTimestampRanges = (text: string): TimestampRangeMatch[] => {
  const normalizedText = typeof text === 'string' ? text : String(text ?? '');
  const matches: TimestampRangeMatch[] = [];
  let match: RegExpExecArray | null;

  TIMESTAMP_RANGE_REGEX.lastIndex = 0;
  while ((match = TIMESTAMP_RANGE_REGEX.exec(normalizedText)) !== null) {
    const startLabel = match[1];
    const endLabel = match[2];
    const startSeconds = parseTimestampToSeconds(startLabel);
    const endSeconds = endLabel ? parseTimestampToSeconds(endLabel) : null;
    if (startSeconds === null) {
      continue;
    }

    matches.push({
      raw: match[0],
      startLabel,
      endLabel: endLabel ?? undefined,
      startSeconds,
      endSeconds: endSeconds ?? undefined,
      index: match.index,
    });
  }

  return matches;
};
