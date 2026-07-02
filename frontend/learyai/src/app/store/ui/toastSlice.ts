// toastSlice 负责管理全局右上角横条提示队列。
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type ToastVariant = 'info' | 'success' | 'error';

export interface ToastItem {
  id: string;
  variant: ToastVariant;
  message: string;
  durationMs: number;
}

interface EnqueueToastPayload {
  variant?: ToastVariant;
  message: string;
  durationMs?: number;
}

interface ToastState {
  toasts: ToastItem[];
}

const DEFAULT_DURATION_MS = 3200;

const initialState: ToastState = {
  toasts: [],
};

const toastSlice = createSlice({
  name: 'toast',
  initialState,
  reducers: {
    enqueueToast: (state, action: PayloadAction<EnqueueToastPayload>) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      state.toasts.push({
        id,
        variant: action.payload.variant ?? 'info',
        message: action.payload.message,
        durationMs: action.payload.durationMs ?? DEFAULT_DURATION_MS,
      });
    },
    dismissToast: (state, action: PayloadAction<string>) => {
      state.toasts = state.toasts.filter((item) => item.id !== action.payload);
    },
    clearToasts: (state) => {
      state.toasts = [];
    },
  },
});

export const { enqueueToast, dismissToast, clearToasts } = toastSlice.actions;

export default toastSlice.reducer;
