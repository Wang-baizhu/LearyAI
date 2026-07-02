// agentWsNormalizer.test.ts 负责验证 WS 协议转换仅在 normalizer 中发生。
import { describe, expect, it } from 'vitest';
import { normalizeAgentWsEnvelope } from '../agentWsNormalizer';

describe('agentWsNormalizer', () => {
  it('会把 payload_json blocks 转成前端内部 payload 结构', () => {
    expect(
      normalizeAgentWsEnvelope({
        event: 'session:context',
        payload: {
          agentSessionId: 'session-1',
          isStreaming: true,
          blocks: [
            {
              type: 'PlanDisplay',
              payload_json: JSON.stringify({
                content: 'plan',
                file_path: '/tmp/plan.md',
              }),
            },
          ],
        },
        meta: { agentSessionId: 'session-1' },
      })
    ).toEqual({
      event: 'session:context',
      payload: {
        agentSessionId: 'session-1',
        isStreaming: true,
        blocks: [
          {
            type: 'PlanDisplay',
            payload_json: '{"content":"plan","file_path":"/tmp/plan.md"}',
            payload: {
              content: 'plan',
              file_path: '/tmp/plan.md',
            },
          },
        ],
      },
      meta: { agentSessionId: 'session-1' },
    });
  });

  it('会透传运行时 event 字符串并规范化 meta', () => {
    expect(
      normalizeAgentWsEnvelope({
        event: 'question:request',
        meta: {
          agentSessionId: 'session-2',
          subagentId: 'agent-1',
          traceId: 'trace-1',
          userId: '1',
        },
        payload: {
          agentSessionId: 'session-2',
          requestId: 'req-1',
          questions: [],
        },
      })
    ).toEqual({
      event: 'question:request',
      payload: {
        agentSessionId: 'session-2',
        requestId: 'req-1',
        questions: [],
      },
      meta: {
        agentSessionId: 'session-2',
        subagentId: 'agent-1',
        traceId: 'trace-1',
        userId: 1,
      },
    });
  });
});
