// 职责: 统一管理模板插件 request/response 的 pending 请求状态。
import type { TemplatePluginErrorPayload } from './protocol';

const buildAbortError = (requestId: string): TemplatePluginErrorPayload => ({
  code: 'REQUEST_ABORTED',
  message: `request ${requestId} aborted`,
});

export const createRequestId = () =>
  `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

export const createRequestTracker = <TPayload = unknown>() => {
  const pending = new Map<
    string,
    {
      resolve: (payload: TPayload) => void;
      reject: (error: TemplatePluginErrorPayload) => void;
    }
  >();

  return {
    create: (requestId = createRequestId()) => ({
      requestId,
      promise: new Promise<TPayload>((resolve, reject) => {
        pending.set(requestId, { resolve, reject });
      }),
    }),
    resolve: (requestId: string | undefined, payload: TPayload) => {
      if (!requestId) {
        return false;
      }
      const item = pending.get(requestId);
      if (!item) {
        return false;
      }
      pending.delete(requestId);
      item.resolve(payload);
      return true;
    },
    reject: (requestId: string | undefined, error: TemplatePluginErrorPayload) => {
      if (!requestId) {
        return false;
      }
      const item = pending.get(requestId);
      if (!item) {
        return false;
      }
      pending.delete(requestId);
      item.reject(error);
      return true;
    },
    abortAll: () => {
      pending.forEach((item, requestId) => {
        item.reject(buildAbortError(requestId));
      });
      pending.clear();
    },
  };
};
