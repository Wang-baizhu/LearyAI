// aiChatQueryBridge 负责在 listener 与 socket 层共享发送器并缓存待发送请求。
import type { AiChatQueryRequestPayload } from '../actions/query';

type AiChatQuerySender = (payload: AiChatQueryRequestPayload) => void;

let sender: AiChatQuerySender | null = null;
const pendingQueue: AiChatQueryRequestPayload[] = [];
let isConnectionReady = false;

const flushQueue = () => {
  if (!sender || !isConnectionReady || pendingQueue.length === 0) return;
  const queue = pendingQueue.splice(0, pendingQueue.length);
  queue.forEach((payload) => sender?.(payload));
};

export const registerAiChatQuerySender = (next: AiChatQuerySender | null) => {
  sender = next;
  if (sender) flushQueue();
  return () => {
    if (sender === next) {
      sender = null;
    }
  };
};

export const sendAiChatQuery = (payload: AiChatQueryRequestPayload) => {
  if (sender && isConnectionReady) {
    sender(payload);
    return;
  }
  pendingQueue.push(payload);
};

export const setAiChatConnectionReady = (ready: boolean) => {
  isConnectionReady = ready;
  if (isConnectionReady) flushQueue();
};
