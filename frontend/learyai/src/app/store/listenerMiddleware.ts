// listenerMiddleware 负责提供全局 Redux 监听中间件实例与类型化监听入口。
import { createListenerMiddleware } from '@reduxjs/toolkit';
import type { AppDispatch, RootState } from './index';

export const listenerMiddleware = createListenerMiddleware();

export const startAppListening = listenerMiddleware.startListening.withTypes<
  RootState,
  AppDispatch
>();
