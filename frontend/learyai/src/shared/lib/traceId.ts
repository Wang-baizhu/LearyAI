// traceId 提供轻量的 traceId 生成方法。
export const createTraceId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `trace-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};
