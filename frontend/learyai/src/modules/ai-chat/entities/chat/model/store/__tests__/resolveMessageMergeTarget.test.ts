// resolveMessageMergeTarget.test.ts 负责覆盖 ai-chat 消息归并优先级与顺序锚点规则。
import { describe, expect, it } from 'vitest';

import type { ChatMessage, ContentBlock } from '../../types/schema';
import { resolveMessageMergeTarget } from '../resolveMessageMergeTarget';

const makeAssistantMessage = (
  id: string,
  blocks: ContentBlock[]
): ChatMessage => ({
  id,
  sender: 'assistant',
  blocks,
});

describe('resolveMessageMergeTarget', () => {
  it('会优先按 taskToolCallId 归并，而不是落到 toolCallId 或顺序锚点', () => {
    const result = resolveMessageMergeTarget({
      messages: [
        makeAssistantMessage('assistant-tool', [
          {
            type: 'tool_call',
            toolCallId: 'tool-1',
            title: 'Search',
            status: 'in_progress',
          },
        ]),
        makeAssistantMessage('assistant-task', [
          {
            type: 'subagent',
            name: 'Worker',
            status: 'begin',
            taskToolCallId: 'task-1',
          },
        ]),
        makeAssistantMessage('assistant-anchor', [{ type: 'text', text: 'anchor' }]),
      ],
      blocks: [
        {
          type: 'tool_result',
          toolCallId: 'tool-1',
          result: 'task result',
          status: 'succeeded',
          taskToolCallId: 'task-1',
        },
      ],
      timestamp: '2026-04-10T10:00:00.000Z',
      assistantMessageId: 'assistant-anchor',
    });

    expect(result.messages).toHaveLength(3);
    expect(result.messages[1]).toMatchObject({
      id: 'assistant-task',
      blocks: [
        {
          type: 'subagent',
          name: 'Worker',
          status: 'begin',
          taskToolCallId: 'task-1',
        },
        {
          type: 'tool_result',
          toolCallId: 'tool-1',
          result: 'task result',
          status: 'succeeded',
          taskToolCallId: 'task-1',
        },
      ],
      updatedAt: '2026-04-10T10:00:00.000Z',
    });
    expect(result.assistantMessageId).toBe('assistant-task');
  });

  it('会优先按 toolCallId 归并，而不是续写当前顺序锚点', () => {
    const result = resolveMessageMergeTarget({
      messages: [
        makeAssistantMessage('assistant-tool', [
          {
            type: 'tool_call',
            toolCallId: 'tool-1',
            title: 'Search',
            status: 'in_progress',
          },
        ]),
        makeAssistantMessage('assistant-anchor', [{ type: 'text', text: 'anchor' }]),
      ],
      blocks: [
        {
          type: 'tool_result',
          toolCallId: 'tool-1',
          result: 'done',
          status: 'succeeded',
        },
      ],
      timestamp: '2026-04-10T10:00:00.000Z',
      assistantMessageId: 'assistant-anchor',
    });

    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]).toMatchObject({
      id: 'assistant-tool',
      blocks: [
        {
          type: 'tool_call',
          toolCallId: 'tool-1',
          title: 'Search',
          status: 'succeeded',
        },
        {
          type: 'tool_result',
          toolCallId: 'tool-1',
          result: 'done',
          status: 'succeeded',
        },
      ],
    });
    expect(result.messages[1]).toMatchObject({
      id: 'assistant-anchor',
      blocks: [{ type: 'text', text: 'anchor' }],
    });
    expect(result.assistantMessageId).toBe('assistant-tool');
  });

  it('只会为纯 sequential assistant blocks 续写当前锚点', () => {
    const result = resolveMessageMergeTarget({
      messages: [
        makeAssistantMessage('assistant-anchor', [{ type: 'text', text: 'hello' }]),
      ],
      blocks: [
        { type: 'text', text: ' world' },
        {
          type: 'tool_result',
          toolCallId: 'tool-1',
          result: 'done',
          status: 'succeeded',
        },
      ],
      timestamp: '2026-04-10T10:00:00.000Z',
      assistantMessageId: 'assistant-anchor',
    });

    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]).toMatchObject({
      id: 'assistant-anchor',
      blocks: [{ type: 'text', text: 'hello' }],
    });
    expect(result.messages[1]).toMatchObject({
      sender: 'assistant',
      blocks: [
        { type: 'text', text: ' world' },
        {
          type: 'tool_result',
          toolCallId: 'tool-1',
          result: 'done',
          status: 'succeeded',
        },
      ],
    });
  });

  it('在顺序锚点被清空后会追加新的 assistant 消息', () => {
    const result = resolveMessageMergeTarget({
      messages: [
        makeAssistantMessage('assistant-anchor', [{ type: 'text', text: 'hello' }]),
      ],
      blocks: [{ type: 'text', text: 'new turn' }],
      timestamp: '2026-04-10T10:00:00.000Z',
      assistantMessageId: null,
    });

    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]).toMatchObject({
      id: 'assistant-anchor',
      blocks: [{ type: 'text', text: 'hello' }],
    });
    expect(result.messages[1]).toMatchObject({
      sender: 'assistant',
      blocks: [{ type: 'text', text: 'new turn' }],
    });
    expect(result.assistantMessageId).toBe(result.messages[1].id);
  });

  it('只有相同 sequential 类型才会续写当前锚点', () => {
    const thinkingResult = resolveMessageMergeTarget({
      messages: [
        makeAssistantMessage('assistant-thinking', [{ type: 'thinking', text: '先分析' }]),
      ],
      blocks: [{ type: 'thinking', text: '再补充' }],
      timestamp: '2026-04-10T10:00:00.000Z',
      assistantMessageId: 'assistant-thinking',
    });

    expect(thinkingResult.messages).toHaveLength(1);
    expect(thinkingResult.messages[0]).toMatchObject({
      id: 'assistant-thinking',
      blocks: [{ type: 'thinking', text: '先分析再补充' }],
    });

    const mixedResult = resolveMessageMergeTarget({
      messages: [
        makeAssistantMessage('assistant-thinking', [{ type: 'thinking', text: '先分析' }]),
      ],
      blocks: [{ type: 'text', text: '现在回答' }],
      timestamp: '2026-04-10T10:00:00.000Z',
      assistantMessageId: 'assistant-thinking',
    });

    expect(mixedResult.messages).toHaveLength(2);
    expect(mixedResult.messages[0]).toMatchObject({
      id: 'assistant-thinking',
      blocks: [{ type: 'thinking', text: '先分析' }],
    });
    expect(mixedResult.messages[1]).toMatchObject({
      sender: 'assistant',
      blocks: [{ type: 'text', text: '现在回答' }],
    });
  });

  it('当 incoming blocks 同时含有多个 toolCallId 时不会错误归并到单个工具消息', () => {
    const result = resolveMessageMergeTarget({
      messages: [
        makeAssistantMessage('assistant-tool', [
          {
            type: 'tool_call',
            toolCallId: 'tool-1',
            title: 'Search',
            status: 'in_progress',
          },
        ]),
      ],
      blocks: [
        {
          type: 'tool_result',
          toolCallId: 'tool-1',
          result: 'done',
          status: 'succeeded',
        },
        {
          type: 'tool_result',
          toolCallId: 'tool-2',
          result: 'other',
          status: 'succeeded',
        },
      ],
      timestamp: '2026-04-10T10:00:00.000Z',
      assistantMessageId: 'assistant-tool',
    });

    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]).toMatchObject({
      id: 'assistant-tool',
      blocks: [
        {
          type: 'tool_call',
          toolCallId: 'tool-1',
          title: 'Search',
          status: 'in_progress',
        },
      ],
    });
    expect(result.messages[1]).toMatchObject({
      sender: 'assistant',
      blocks: [
        {
          type: 'tool_result',
          toolCallId: 'tool-1',
          result: 'done',
          status: 'succeeded',
        },
        {
          type: 'tool_result',
          toolCallId: 'tool-2',
          result: 'other',
          status: 'succeeded',
        },
      ],
    });
  });
});
