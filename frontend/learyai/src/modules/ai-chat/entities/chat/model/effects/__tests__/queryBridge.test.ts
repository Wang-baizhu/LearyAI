// queryBridge.test.ts 负责验证 AI Chat 查询桥接层的排队与刷队逻辑。
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiChatQueryRequestPayload } from '../../actions/query';

import {
  registerAiChatQuerySender,
  sendAiChatQuery,
  setAiChatConnectionReady,
} from '../queryBridge';

describe('ai chat query bridge', () => {
  beforeEach(() => {
    setAiChatConnectionReady(false);
    registerAiChatQuerySender(null);
  });

  it('在连接未就绪时会先缓存请求，待 sender 注册且 ready 后再统一发送', () => {
    const sender = vi.fn();
    const firstPayload: AiChatQueryRequestPayload = { prompt: [{ type: 'text', text: '第一个请求' }] };
    const secondPayload: AiChatQueryRequestPayload = { prompt: [{ type: 'text', text: '第二个请求' }] };

    sendAiChatQuery(firstPayload);
    sendAiChatQuery(secondPayload);

    registerAiChatQuerySender(sender);
    expect(sender).not.toHaveBeenCalled();

    setAiChatConnectionReady(true);

    expect(sender).toHaveBeenNthCalledWith(1, firstPayload);
    expect(sender).toHaveBeenNthCalledWith(2, secondPayload);
  });

  it('连接就绪后会直接发送，并且 unregister 只会移除当前 sender', () => {
    const senderA = vi.fn();
    const senderB = vi.fn();

    setAiChatConnectionReady(true);
    const unregisterA = registerAiChatQuerySender(senderA);
    const unregisterB = registerAiChatQuerySender(senderB);

    const directPayload: AiChatQueryRequestPayload = { prompt: [{ type: 'text', text: '直发请求' }] };
    sendAiChatQuery(directPayload);

    expect(senderA).not.toHaveBeenCalled();
    expect(senderB).toHaveBeenCalledWith(directPayload);

    unregisterA();
    const secondDirectPayload: AiChatQueryRequestPayload = {
      prompt: [{ type: 'text', text: '仍由 B 发送' }],
    };
    sendAiChatQuery(secondDirectPayload);
    expect(senderB).toHaveBeenCalledWith(secondDirectPayload);

    unregisterB();
    sendAiChatQuery({ prompt: [{ type: 'text', text: '再次排队' }] });
    expect(senderB).toHaveBeenCalledTimes(2);
  });
});
