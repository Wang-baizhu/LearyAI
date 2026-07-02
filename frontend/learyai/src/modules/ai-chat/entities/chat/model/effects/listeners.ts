// aiChatListeners 负责监听跨模块请求并转发到 socket 层。
import { startAppListening } from '@/app/store/listenerMiddleware';
import { requestAiChatQuery } from '../actions/query';
import { enterTempSession, TEMP_SESSION_ID } from '../store/slice';
import { sendAiChatQuery } from './queryBridge';

let registered = false;

export const registerAiChatListeners = () => {
  if (registered) return;
  registered = true;

  const normalizeContextId = (value?: string) => (value?.trim() ? value.trim() : undefined);

  startAppListening({
    actionCreator: requestAiChatQuery,
    effect: async (action, listenerApi) => {
      const state = listenerApi.getState();
      const context = state.resourceCenter.currentContext;
      const payload = {
        ...action.payload,
        projectId: normalizeContextId(action.payload.projectId) ?? normalizeContextId(context.projectId),
        kbId: normalizeContextId(action.payload.kbId) ?? normalizeContextId(context.kbId),
      };
      const connectionStatus = state.aiChat.connection.status;
      if (connectionStatus !== 'open') {
        if (action.payload.waitForConnection) {
          sendAiChatQuery(payload);
          return;
        }
        const activeSessionId = state.aiChat.activeSessionId;
        if (!activeSessionId || activeSessionId === TEMP_SESSION_ID) {
          listenerApi.dispatch(enterTempSession());
        }
        return;
      }

      sendAiChatQuery(payload);
    },
  });
};
