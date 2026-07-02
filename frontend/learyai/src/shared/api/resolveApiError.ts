// resolveApiErrorMessage 负责统一解析接口错误信息。
export const resolveApiErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object') {
    const message = (error as { message?: string }).message;
    const code = (error as { code?: string }).code;
    if (message) {
      return message;
    }
    if (code) {
      return code;
    }
  }
  return fallback;
};
