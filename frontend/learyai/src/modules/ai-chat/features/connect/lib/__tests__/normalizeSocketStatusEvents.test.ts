// normalizeSocketStatusEvents.test.ts 负责验证 AI Chat socket 状态事件到归一化事件的映射规则。
import { describe, expect, it } from 'vitest';
import { normalizeSocketStatusEvents } from '../normalizeSocketStatusEvents';

describe('normalizeSocketStatusEvents', () => {
  it('会把 query:state 映射为 session.status', () => {
    expect(
      normalizeSocketStatusEvents({
        cmd: 'query:state',
        payload: {
          agentSessionId: 'session-1',
          isStreaming: true,
        },
      })
    ).toEqual([
      {
        type: 'session.status',
        agentSessionId: 'session-1',
        status: {
          exists: true,
          isStreaming: true,
        },
      },
    ]);
  });

  it('会把 agent.result 映射为结束流式状态并清理 needContext', () => {
    expect(
      normalizeSocketStatusEvents({
        cmd: 'agent.result',
        payload: {},
        meta: {
          agentSessionId: 'session-2',
        },
      })
    ).toEqual([
      {
        type: 'session.status',
        agentSessionId: 'session-2',
        status: {
          exists: true,
          isStreaming: false,
        },
      },
      {
        type: 'session.needContext',
        agentSessionId: 'session-2',
        needContext: false,
      },
      {
        type: 'session.terminalStatus',
        agentSessionId: 'session-2',
        status: 'completed',
      },
    ]);
  });

  it('会把 permission:request 映射为 permission.request，并回填 requestId', () => {
    expect(
      normalizeSocketStatusEvents({
        cmd: 'permission:request',
        payload: {
          toolCallId: 'tool-1',
          title: '请求授权',
          description: '需要执行外部命令',
          options: ['allow', 'deny'],
          timeout: 30,
        },
        meta: {
          agentSessionId: 'session-3',
        },
      })
    ).toEqual([
      expect.objectContaining({
        type: 'permission.request',
        agentSessionId: 'session-3',
        request: expect.objectContaining({
          requestId: 'tool-1',
          toolCallId: 'tool-1',
          title: '请求授权',
          description: '需要执行外部命令',
          options: ['allow', 'deny'],
          timeout: 30,
          createdAt: expect.any(String),
        }),
      }),
    ]);
  });

  it('子 agent 请求会继续落到父 session，但保留 subagentId 供回调使用', () => {
    expect(
      normalizeSocketStatusEvents({
        cmd: 'question:request',
        payload: {
          requestId: 'req-1',
          toolCallId: 'tool-1',
          subagentId: 'agent-1',
          questions: [],
        },
        meta: {
          agentSessionId: 'session-parent',
        },
      })
    ).toEqual([
      {
        type: 'question.request',
        agentSessionId: 'session-parent',
        request: {
          requestId: 'req-1',
          toolCallId: 'tool-1',
          questions: [],
          subagentId: 'agent-1',
          createdAt: expect.any(String),
        },
      },
    ]);
  });

  it('在缺少 action 或 agentSessionId 时返回空数组', () => {
    expect(
      normalizeSocketStatusEvents({
        cmd: '',
        payload: {},
      })
    ).toEqual([]);

    expect(
      normalizeSocketStatusEvents({
        cmd: 'agent.cancelled',
        payload: {},
        meta: {},
      })
    ).toEqual([]);
  });

  it('对未知事件返回空数组', () => {
    expect(
      normalizeSocketStatusEvents({
        cmd: 'unknown:event',
        payload: {},
      })
    ).toEqual([]);
  });
});
