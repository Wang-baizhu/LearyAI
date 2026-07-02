// useAsyncStatus 刻画通用异步操作的状态机，便于 feature 复用请求反馈。
import { useCallback, useState } from 'react';

export type AsyncState = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncStatus {
  state: AsyncState;
  message?: string;
}

const initialStatus: AsyncStatus = { state: 'idle', message: undefined };

export const useAsyncStatus = () => {
  const [status, setStatus] = useState<AsyncStatus>(initialStatus);

  const setIdle = useCallback(() => setStatus(initialStatus), []);
  const setLoading = useCallback((message?: string) => setStatus({ state: 'loading', message }), []);
  const setSuccess = useCallback((message?: string) => setStatus({ state: 'success', message }), []);
  const setError = useCallback((message?: string) => setStatus({ state: 'error', message }), []);

  return {
    status,
    setIdle,
    setLoading,
    setSuccess,
    setError,
  };
};
