// wireBlocksProcessor.test.ts 负责验证 wire blocks 到 normalized events 的关键时序行为。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createTraceId: vi.fn(),
}));

vi.mock('@/shared/lib/traceId', () => ({
  createTraceId: mocks.createTraceId,
}));

import { createAiChatWireEventProcessor } from '../wireBlocksProcessor';

describe('wireBlocksProcessor', () => {
  beforeEach(() => {
    mocks.createTraceId.mockReset();
    mocks.createTraceId.mockReturnValueOnce('user-1').mockReturnValueOnce('assistant-1');
  });

  it('会在 streaming 的 session:context 前先发出 session.status=true，供后续增量续写同一条 assistant 消息', () => {
    const processor = createAiChatWireEventProcessor();

    expect(
      processor.processContext(
        'session-1',
        [
          {
            type: 'TurnBegin',
            payload: {
              user_input: [{ type: 'text', text: '问题' }],
            },
          },
          {
            type: 'ContentPart',
            payload: {
              type: 'text',
              text: '首段回答',
            },
          },
        ],
        true
      )
    ).toEqual([
      {
        type: 'session.status',
        agentSessionId: 'session-1',
        status: { exists: true, isStreaming: true },
      },
      {
        type: 'messages.reset',
        agentSessionId: 'session-1',
        messages: [
          {
            id: 'user-user-1',
            sender: 'user',
            blocks: [{ type: 'text', text: '问题' }],
          },
          {
            id: 'assistant-assistant-1',
            sender: 'assistant',
            blocks: [{ type: 'text', text: '首段回答' }],
          },
        ],
      },
      {
        type: 'session.needContext',
        agentSessionId: 'session-1',
        needContext: false,
      },
    ]);
  });

  it('补更早历史页时会产出 messages.prepend，而不是重置当前消息列表', () => {
    const processor = createAiChatWireEventProcessor();

    expect(
      processor.processContext(
        'session-1',
        [
          {
            type: 'TurnBegin',
            payload: {
              user_input: [{ type: 'text', text: '更早问题' }],
            },
          },
          {
            type: 'ContentPart',
            payload: {
              type: 'text',
              text: '更早回答',
            },
          },
        ],
        false,
        true
      )
    ).toEqual([
      {
        type: 'messages.prepend',
        agentSessionId: 'session-1',
        messages: [
          {
            id: 'user-user-1',
            sender: 'user',
            blocks: [{ type: 'text', text: '更早问题' }],
          },
          {
            id: 'assistant-assistant-1',
            sender: 'assistant',
            blocks: [{ type: 'text', text: '更早回答' }],
          },
        ],
      },
    ]);
  });

  it('会在 TurnBegin 前先冲刷当前 assistant blocks，再发出新的用户消息', () => {
    const processor = createAiChatWireEventProcessor();

    expect(
      processor.processUpdate('session-1', [
        {
          type: 'ContentPart',
          payload: {
            type: 'text',
            text: '旧回答',
          },
        },
        {
          type: 'ToolCall',
          payload: {
            id: 'tool-1',
            function: {
              name: 'Search',
              arguments: '{"q":"leary"}',
            },
          },
        },
        {
          type: 'TurnBegin',
          payload: {
            user_input: [{ type: 'text', text: '新问题' }],
          },
        },
      ])
    ).toEqual([
      {
        type: 'message.blocks',
        agentSessionId: 'session-1',
        sender: 'assistant',
        blocks: [
          { type: 'text', text: '旧回答' },
          {
            type: 'tool_call',
            toolCallId: 'tool-1',
            title: 'Search',
            status: 'in_progress',
            args: '{"q":"leary"}',
          },
        ],
      },
      {
        type: 'message.blocks',
        agentSessionId: 'session-1',
        sender: 'user',
        blocks: [{ type: 'text', text: '新问题' }],
      },
    ]);
  });

  it('会在 StepBegin 时发出 assistant message boundary 事件', () => {
    const processor = createAiChatWireEventProcessor();

    expect(
      processor.processUpdate('session-1', [
        {
          type: 'StepBegin',
          payload: {},
        },
      ])
    ).toEqual([
      {
        type: 'assistant.messageBoundary',
        agentSessionId: 'session-1',
      },
    ]);
  });

  it('会在 StepBegin 前先冲刷旧 assistant blocks，再切换到下一条消息边界', () => {
    const processor = createAiChatWireEventProcessor();

    expect(
      processor.processUpdate('session-1', [
        {
          type: 'ContentPart',
          payload: {
            type: 'text',
            text: '旧回答',
          },
        },
        {
          type: 'StepBegin',
          payload: {},
        },
        {
          type: 'ContentPart',
          payload: {
            type: 'text',
            text: '新回答',
          },
        },
      ])
    ).toEqual([
      {
        type: 'message.blocks',
        agentSessionId: 'session-1',
        sender: 'assistant',
        blocks: [{ type: 'text', text: '旧回答' }],
      },
      {
        type: 'assistant.messageBoundary',
        agentSessionId: 'session-1',
      },
      {
        type: 'message.blocks',
        agentSessionId: 'session-1',
        sender: 'assistant',
        blocks: [{ type: 'text', text: '新回答' }],
      },
    ]);
  });

  it('会在 Agent 参数拼完整后发出 subagent begin，并在结果到达后补齐 end 和 tool_result', () => {
    const processor = createAiChatWireEventProcessor();

    expect(
      processor.processUpdate('session-1', [
        {
          type: 'ToolCall',
          payload: {
            id: 'task-1',
            function: {
              name: 'Agent',
              arguments: '{"subagent_type":"Wor',
            },
          },
        },
        {
          type: 'ToolCallPart',
          payload: {
            arguments_part: 'ker","description":"Run checks"}',
          },
        },
      ])
    ).toEqual([
      {
        type: 'message.blocks',
        agentSessionId: 'session-1',
        sender: 'assistant',
        blocks: [
          {
            type: 'subagent',
            name: 'Worker',
            status: 'begin',
            text: 'Run checks',
            taskToolCallId: 'task-1',
          },
        ],
      },
    ]);

    expect(
      processor.processUpdate('session-1', [
        {
          type: 'ToolResult',
          payload: {
            tool_call_id: 'task-1',
            return_value: {
              output: 'done',
            },
          },
        },
      ])
    ).toEqual([
      {
        type: 'message.blocks',
        agentSessionId: 'session-1',
        sender: 'assistant',
        blocks: [
          {
            type: 'subagent',
            name: 'Worker',
            status: 'end',
            text: 'Run checks',
            taskToolCallId: 'task-1',
          },
          {
            type: 'tool_result',
            toolCallId: 'task-1',
            result: 'done',
            status: 'succeeded',
            taskToolCallId: 'task-1',
          },
        ],
      },
    ]);
  });

  it('会为普通工具调用补齐参数并输出 tool_call 与 tool_result', () => {
    const processor = createAiChatWireEventProcessor();

    expect(
      processor.processUpdate('session-1', [
        {
          type: 'ToolCall',
          payload: {
            id: 'tool-1',
            function: {
              name: 'Search',
              arguments: '{"q":"lea',
            },
          },
        },
        {
          type: 'ToolCallPart',
          payload: {
            arguments_part: 'ry"}',
          },
        },
        {
          type: 'ToolResult',
          payload: {
            tool_call_id: 'tool-1',
            return_value: {
              output: 'result',
            },
          },
        },
      ])
    ).toEqual([
      {
        type: 'message.blocks',
        agentSessionId: 'session-1',
        sender: 'assistant',
        blocks: [
          {
            type: 'tool_call',
            toolCallId: 'tool-1',
            title: 'Search',
            status: 'in_progress',
            args: '{"q":"leary"}',
          },
          {
            type: 'tool_result',
            toolCallId: 'tool-1',
            result: 'result',
            status: 'succeeded',
          },
        ],
      },
    ]);
  });

  it('会在 thinking 与 text 切换时冲刷当前文本缓冲，避免混成同一块', () => {
    const processor = createAiChatWireEventProcessor();

    expect(
      processor.processUpdate('session-1', [
        {
          type: 'ContentPart',
          payload: {
            type: 'think',
            think: '先分析',
          },
        },
        {
          type: 'ContentPart',
          payload: {
            type: 'text',
            text: '再回答',
          },
        },
      ])
    ).toEqual([
      {
        type: 'message.blocks',
        agentSessionId: 'session-1',
        sender: 'assistant',
        blocks: [
          { type: 'thinking', text: '先分析' },
          { type: 'text', text: '再回答' },
        ],
      },
    ]);
  });

  it('会在 subagent 的 thinking 与 text 切换时拆成两段 update', () => {
    const processor = createAiChatWireEventProcessor();

    expect(
      processor.processUpdate('session-1', [
        {
            type: 'ToolCall',
            payload: {
              id: 'task-1',
              function: {
                name: 'Agent',
                arguments: '{"subagent_type":"Worker","description":"Run checks"}',
              },
            },
          },
        {
          type: 'SubagentEvent',
          payload: {
            parent_tool_call_id: 'task-1',
            event: {
              type: 'ContentPart',
              payload: {
                type: 'think',
                think: '先计划',
              },
            },
          },
        },
        {
          type: 'SubagentEvent',
          payload: {
            parent_tool_call_id: 'task-1',
            event: {
              type: 'ContentPart',
              payload: {
                type: 'text',
                text: '再执行',
              },
            },
          },
        },
      ])
    ).toEqual([
      {
        type: 'message.blocks',
        agentSessionId: 'session-1',
        sender: 'assistant',
        blocks: [
          {
            type: 'subagent',
            name: 'Worker',
            status: 'begin',
            text: 'Run checks',
            taskToolCallId: 'task-1',
          },
          {
            type: 'subagent',
            name: 'Worker',
            status: 'update',
            text: '先计划',
            taskToolCallId: 'task-1',
          },
          {
            type: 'subagent',
            name: 'Worker',
            status: 'update',
            text: '再执行',
            taskToolCallId: 'task-1',
          },
        ],
      },
    ]);
  });

  it('会在 subagent 文本后收到 subagent tool_call 时先冲刷 update 再输出 tool_call', () => {
    const processor = createAiChatWireEventProcessor();

    expect(
      processor.processUpdate('session-1', [
        {
            type: 'ToolCall',
            payload: {
              id: 'task-1',
              function: {
                name: 'Agent',
                arguments: '{"subagent_type":"Worker","description":"Run checks"}',
              },
            },
          },
        {
          type: 'SubagentEvent',
          payload: {
            parent_tool_call_id: 'task-1',
            event: {
              type: 'ContentPart',
              payload: {
                type: 'text',
                text: '正在检索',
              },
            },
          },
        },
        {
          type: 'SubagentEvent',
          payload: {
            parent_tool_call_id: 'task-1',
            event: {
              type: 'ToolCall',
              payload: {
                id: 'tool-2',
                function: {
                  name: 'Search',
                  arguments: '{"q":"nested"}',
                },
              },
            },
          },
        },
      ])
    ).toEqual([
      {
        type: 'message.blocks',
        agentSessionId: 'session-1',
        sender: 'assistant',
        blocks: [
          {
            type: 'subagent',
            name: 'Worker',
            status: 'begin',
            text: 'Run checks',
            taskToolCallId: 'task-1',
          },
          {
            type: 'subagent',
            name: 'Worker',
            status: 'update',
            text: '正在检索',
            taskToolCallId: 'task-1',
          },
          {
            type: 'tool_call',
            toolCallId: 'tool-2',
            title: 'Search',
            status: 'in_progress',
            args: '{"q":"nested"}',
            subagentName: 'Worker',
            taskToolCallId: 'task-1',
          },
        ],
      },
    ]);
  });

  it('会渲染新的 plan、notification 和状态类 wire block', () => {
    const processor = createAiChatWireEventProcessor();

    expect(
      processor.processUpdate('session-1', [
        {
          type: 'PlanDisplay',
          payload: {
            content: '1. 收集上下文\n2. 修改前端',
            file_path: '/tmp/plan.md',
          },
        },
        {
          type: 'Notification',
          payload: {
            id: 'notif-1',
            title: '后台任务完成',
            body: '索引已经刷新。',
            severity: 'warning',
            category: 'background',
          },
        },
        {
          type: 'HookTriggered',
          payload: {
            event: 'pre_tool',
            target: 'Search',
          },
        },
      ])
    ).toEqual([
      {
        type: 'message.blocks',
        agentSessionId: 'session-1',
        sender: 'assistant',
        blocks: [
          {
            type: 'plan',
            content: '1. 收集上下文\n2. 修改前端',
            filePath: '/tmp/plan.md',
          },
          {
            type: 'notification',
            notificationId: 'notif-1',
            title: '后台任务完成',
            body: '索引已经刷新。',
            severity: 'warning',
            category: 'background',
          },
          {
            type: 'status',
            title: 'Hook 已触发：pre_tool',
            description: 'Search',
            tone: 'info',
          },
        ],
      },
    ]);
  });

  it('会优先使用父调用 id 聚合 subagent，而不是独立 agent_id', () => {
    const processor = createAiChatWireEventProcessor();

    expect(
      processor.processUpdate('session-1', [
        {
          type: 'SubagentEvent',
          payload: {
            parent_tool_call_id: 'task-1',
            agent_id: 'agent-42',
            subagent_type: 'explorer',
            event: {
              type: 'TurnBegin',
              payload: {},
            },
          },
        },
        {
          type: 'SubagentEvent',
          payload: {
            parent_tool_call_id: 'task-1',
            agent_id: 'agent-42',
            subagent_type: 'explorer',
            event: {
              type: 'TextPart',
              payload: {
                text: '正在读取代码',
              },
            },
          },
        },
      ])
    ).toEqual([
      {
        type: 'message.blocks',
        agentSessionId: 'session-1',
        sender: 'assistant',
        blocks: [
          {
            type: 'subagent',
            name: 'explorer',
            status: 'begin',
            text: undefined,
            taskToolCallId: 'task-1',
          },
          {
            type: 'subagent',
            name: 'explorer',
            status: 'update',
            text: '正在读取代码',
            taskToolCallId: 'task-1',
          },
        ],
      },
    ]);
  });
});
