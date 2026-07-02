// formatters 提供通用格式化能力。
export const formatVisitedAt = (visitedAt?: string | null) => {
  if (!visitedAt) {
    return '未访问';
  }
  const date = new Date(visitedAt);
  if (Number.isNaN(date.getTime())) {
    return '未访问';
  }
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const URL_PROTOCOL_PATTERN = /^https?:\/\//i;

export const formatUrlDisplayName = (value: string, maxLength = 44) => {
  if (!URL_PROTOCOL_PATTERN.test(value) || value.length <= maxLength) {
    return value;
  }
  const [baseUrl] = value.split(/[?#]/, 1);
  if (baseUrl.length <= maxLength) {
    return `${baseUrl}...`;
  }
  return `${baseUrl.slice(0, maxLength)}...`;
};
