// store/index 负责配置 Redux store 并导出根状态与调度类型，组合各业务模块的 reducer。
import { configureStore } from '@reduxjs/toolkit';
import { userReducer } from '@/modules/auth';
import dialogReducer from './ui/dialogSlice';
import toastReducer from './ui/toastSlice';
import resourceCenterReducer from '../../modules/resource/entities/resource-center/model/store/slice';
import { aiChatReducer, registerAiChatListeners } from '@/modules/ai-chat';
import { listenerMiddleware } from './listenerMiddleware';

export const store = configureStore({
  reducer: {
    user: userReducer,
    dialog: dialogReducer,
    toast: toastReducer,
    resourceCenter: resourceCenterReducer,
    aiChat: aiChatReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().prepend(listenerMiddleware.middleware),
});

registerAiChatListeners();

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
