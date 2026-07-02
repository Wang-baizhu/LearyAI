// mockReplay.test.ts 负责验证 AI Chat mock 收集与回放工具。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createTraceId: vi.fn(),
}));

vi.mock('@/shared/lib/traceId', () => ({
  createTraceId: mocks.createTraceId,
}));

import {
  buildAiChatMockReplayEvents,
  createAiChatMockCollector,
  formatAiChatMockReplayTurn,
  isQueryStreamingFinished,
  normalizeAiChatMockReplayTurn,
} from '../mockReplay';

describe('mockReplay', () => {
  beforeEach(() => {
    mocks.createTraceId.mockReset();
    let index = 0;
    mocks.createTraceId.mockImplementation(() => {
      index += 1;
      return `trace-${index}`;
    });
  });

  it('collector 会按原始事件顺序收集 session:context 与 message:update', () => {
    const collector = createAiChatMockCollector();

    collector.collectEvent('session-1', {
      cmd: 'session:context',
      payload: {
        blocks: [{ type: 'ContentPart', payload: { type: 'text', text: 'context' } }],
        isStreaming: true,
      },
    });
    collector.collectEvent('session-1', {
      cmd: 'message:update',
      payload: {
        blocks: [{ type: 'ContentPart', payload: { type: 'text', text: 'delta' } }],
        isStreaming: false,
      },
    });

    expect(collector.flush('session-1')).toEqual({
      hasSessionContext: true,
      hasMessageUpdate: true,
      turn: {
        events: [
          {
            cmd: 'session:context',
            payload: {
              blocks: [{ type: 'ContentPart', payload: { type: 'text', text: 'context' } }],
              isStreaming: true,
            },
          },
          {
            cmd: 'message:update',
            payload: {
              blocks: [{ type: 'ContentPart', payload: { type: 'text', text: 'delta' } }],
              isStreaming: false,
            },
          },
        ],
      },
    });
    expect(collector.flush('session-1')).toBeNull();
  });

  it('buildAiChatMockReplayEvents 会从旧的 SubagentEvent 录制里补出子 session 创建与 streaming 事件', () => {
    expect(
      buildAiChatMockReplayEvents(
        {
          events: [
            {
              cmd: 'messages:updated',
              payload: {
                blocks: [
                  {
                    type: 'ToolCall',
                    payload: {
                      id: 'tool-1',
                      function: {
                        name: 'Agent',
                        arguments: JSON.stringify({
                          description: 'Explorer',
                          subagent_type: 'explorer',
                        }),
                      },
                    },
                  },
                ],
                isStreaming: true,
              },
            },
            {
              cmd: 'messages:updated',
              payload: {
                blocks: [
                  {
                    type: 'SubagentEvent',
                    payload: {
                      parent_tool_call_id: 'tool-1',
                      agent_id: 'agent-sub-1',
                      subagent_type: 'explorer',
                      event: {
                        type: 'TurnBegin',
                        payload: {},
                      },
                    },
                  },
                ],
                isStreaming: true,
              },
            },
            {
              cmd: 'messages:updated',
              payload: {
                blocks: [
                  {
                    type: 'SubagentEvent',
                    payload: {
                      parent_tool_call_id: 'tool-1',
                      agent_id: 'agent-sub-1',
                      subagent_type: 'explorer',
                      event: {
                        type: 'TurnEnd',
                        payload: {},
                      },
                    },
                  },
                ],
                isStreaming: true,
              },
            },
          ],
        },
        'session-parent'
      )
    ).toEqual([
      {
        cmd: 'messages:updated',
        payload: {
          blocks: [
            {
              type: 'ToolCall',
              payload: {
                id: 'tool-1',
                function: {
                  name: 'Agent',
                  arguments: JSON.stringify({
                    description: 'Explorer',
                    subagent_type: 'explorer',
                  }),
                },
              },
            },
          ],
          isStreaming: true,
        },
        meta: {
          agentSessionId: 'session-parent',
          traceId: 'trace-1',
        },
      },
      {
        cmd: 'session:created',
        payload: {
          agentSessionId: 'agent-sub-1',
          status: 'ok',
          name: 'Explorer',
          sessionType: 'subagent',
          parentSessionId: 'session-parent',
          subagentType: 'explorer',
        },
        meta: {
          agentSessionId: 'session-parent',
          traceId: 'trace-2',
        },
      },
      {
        cmd: 'query:state',
        payload: {
          agentSessionId: 'agent-sub-1',
          isStreaming: true,
        },
        meta: {
          agentSessionId: 'agent-sub-1',
          traceId: 'trace-3',
        },
      },
      {
        cmd: 'messages:updated',
        payload: {
          blocks: [
            {
              type: 'SubagentEvent',
              payload: {
                parent_tool_call_id: 'tool-1',
                agent_id: 'agent-sub-1',
                subagent_type: 'explorer',
                event: {
                  type: 'TurnBegin',
                  payload: {},
                },
              },
            },
          ],
          isStreaming: true,
        },
        meta: {
          agentSessionId: 'session-parent',
          traceId: 'trace-4',
        },
      },
      {
        cmd: 'messages:updated',
        payload: {
          blocks: [
            {
              type: 'SubagentEvent',
              payload: {
                parent_tool_call_id: 'tool-1',
                agent_id: 'agent-sub-1',
                subagent_type: 'explorer',
                event: {
                  type: 'TurnEnd',
                  payload: {},
                },
              },
            },
          ],
          isStreaming: true,
        },
        meta: {
          agentSessionId: 'session-parent',
          traceId: 'trace-5',
        },
      },
      {
        cmd: 'query:state',
        payload: {
          agentSessionId: 'agent-sub-1',
          isStreaming: false,
        },
        meta: {
          agentSessionId: 'agent-sub-1',
          traceId: 'trace-6',
        },
      },
    ]);
  });

  it('会兼容旧的 sessionContext+updates 结构并格式化成新的 events[] 结构', () => {
    expect(
      normalizeAiChatMockReplayTurn({
        sessionContext: {
          blocks: [{ type: 'ContentPart', payload: { type: 'text', text: 'context' } }],
          isStreaming: false,
        },
        updates: [
          {
            cmd: 'messages:updated',
            payload: {
              blocks: [{ type: 'ContentPart', payload: { type: 'text', text: 'reply' } }],
              isStreaming: false,
            },
          },
        ],
      })
    ).toEqual({
      events: [
        {
          cmd: 'session:context',
          payload: {
            blocks: [{ type: 'ContentPart', payload: { type: 'text', text: 'context' } }],
            isStreaming: false,
          },
        },
        {
          cmd: 'messages:updated',
          payload: {
            blocks: [{ type: 'ContentPart', payload: { type: 'text', text: 'reply' } }],
            isStreaming: false,
          },
        },
      ],
    });

    expect(
      formatAiChatMockReplayTurn({
        events: [
          {
            cmd: 'session:context',
            payload: {
              blocks: [{ type: 'ContentPart', payload: { type: 'text', text: 'context' } }],
              isStreaming: false,
            },
          },
        ],
      })
    ).toBe(`{
  "events": [
    {
      "cmd": "session:context",
      "payload": {
        "blocks": [
          {
            "type": "ContentPart",
            "payload": {
              "type": "text",
              "text": "context"
            }
          }
        ],
        "isStreaming": false
      }
    }
  ]
}`);
  });

  it('buildAiChatMockReplayEvents 会按录制顺序回放真实事件', () => {
    expect(
      buildAiChatMockReplayEvents(
        {
          events: [
            {
              cmd: 'session:context',
              payload: {
                blocks: [{ type: 'ContentPart', payload: { type: 'text', text: 'context' } }],
                isStreaming: false,
              },
            },
            {
              cmd: 'message:update',
              payload: {
                blocks: [{ type: 'ContentPart', payload: { type: 'text', text: 'delta' } }],
                isStreaming: false,
              },
            },
          ],
        },
        'session-1'
      )
    ).toEqual([
      {
        cmd: 'session:context',
        payload: {
          blocks: [{ type: 'ContentPart', payload: { type: 'text', text: 'context' } }],
          isStreaming: false,
        },
        meta: {
          agentSessionId: 'session-1',
          traceId: 'trace-1',
        },
      },
      {
        cmd: 'message:update',
        payload: {
          blocks: [{ type: 'ContentPart', payload: { type: 'text', text: 'delta' } }],
          isStreaming: false,
        },
        meta: {
          agentSessionId: 'session-1',
          traceId: 'trace-2',
        },
      },
    ]);
  });

  it('buildAiChatMockReplayEvents 会把录制时的根 sessionId 重映射到当前 replay sessionId', () => {
    expect(
      buildAiChatMockReplayEvents(
        {
          events: [
            {
              cmd: 'query:state',
              payload: {
                agentSessionId: 'recorded-root-session',
                isStreaming: true,
              },
              meta: {
                agentSessionId: 'recorded-root-session',
              },
            },
            {
              cmd: 'session:created',
              payload: {
                agentSessionId: 'agent-sub-1',
                status: 'ok',
                name: 'Explorer',
                sessionType: 'subagent',
                parentSessionId: 'recorded-root-session',
                subagentType: 'explorer',
              },
              meta: {
                agentSessionId: 'recorded-root-session',
              },
            },
            {
              cmd: 'query:state',
              payload: {
                agentSessionId: 'agent-sub-1',
                isStreaming: true,
              },
              meta: {
                agentSessionId: 'agent-sub-1',
              },
            },
          ],
        },
        'replay-root-session'
      )
    ).toEqual([
      {
        cmd: 'query:state',
        payload: {
          agentSessionId: 'replay-root-session',
          isStreaming: true,
        },
        meta: {
          agentSessionId: 'replay-root-session',
          traceId: 'trace-1',
        },
      },
      {
        cmd: 'session:created',
        payload: {
          agentSessionId: 'agent-sub-1',
          status: 'ok',
          name: 'Explorer',
          sessionType: 'subagent',
          parentSessionId: 'replay-root-session',
          subagentType: 'explorer',
        },
        meta: {
          agentSessionId: 'replay-root-session',
          traceId: 'trace-2',
        },
      },
      {
        cmd: 'query:state',
        payload: {
          agentSessionId: 'agent-sub-1',
          isStreaming: true,
        },
        meta: {
          agentSessionId: 'agent-sub-1',
          traceId: 'trace-3',
        },
      },
    ]);
  });

  it('isQueryStreamingFinished 只在 query:state 且 isStreaming=false 时返回 true', () => {
    expect(isQueryStreamingFinished('query:state', { isStreaming: false })).toBe(true);
    expect(isQueryStreamingFinished('query:state', { isStreaming: true })).toBe(false);
    expect(isQueryStreamingFinished('agent.result', { isStreaming: false })).toBe(false);
  });
});
