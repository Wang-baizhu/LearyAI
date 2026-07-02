// groupBlocks.test.ts 负责验证 content block 在聚合阶段的分组结果。
import { describe, expect, it } from 'vitest';
import { buildGroupedBlocks } from '../groupBlocks';

describe('buildGroupedBlocks', () => {
  it('会把 tool_call 与 tool_result 聚合为 tool group', () => {
    expect(
      buildGroupedBlocks(
        [
          { type: 'text', text: '前置说明' },
          { type: 'tool_call', toolCallId: 'tool-1', title: 'Search', status: 'succeeded' },
          { type: 'tool_result', toolCallId: 'tool-1', result: '命中' },
        ],
        'assistant-1'
      )
    ).toEqual([
      {
        kind: 'grouped_text',
        key: 'assistant-1-text-0',
        text: '前置说明',
      },
      {
        kind: 'grouped_tool_group',
        key: 'assistant-1-tool-group-tool-1-1',
        call: {
          type: 'tool_call',
          toolCallId: 'tool-1',
          title: 'Search',
          status: 'succeeded',
        },
        result: {
          type: 'tool_result',
          toolCallId: 'tool-1',
          result: '命中',
        },
      },
    ]);
  });

  it('会把 subagent 流程块聚合为单个 subagent group', () => {
    expect(
      buildGroupedBlocks(
        [
          { type: 'subagent', name: 'Worker', status: 'begin', text: '执行检查', taskToolCallId: 'task-1' },
          { type: 'subagent', name: 'Worker', status: 'update', text: '先检索', taskToolCallId: 'task-1' },
          {
            type: 'tool_call',
            toolCallId: 'tool-1',
            title: 'Search',
            status: 'in_progress',
            taskToolCallId: 'task-1',
            subagentName: 'Worker',
          },
          { type: 'subagent', name: 'Worker', status: 'update', text: '再总结', taskToolCallId: 'task-1' },
        ],
        'assistant-1'
      )
    ).toEqual([
      {
        kind: 'grouped_subagent_group',
        key: 'assistant-1-subagent-task-1-0',
        taskToolCallId: 'task-1',
        name: 'Worker',
        status: 'update',
        description: '执行检查',
        flowBlocks: [
          {
            kind: 'grouped_text',
            key: 'assistant-1-subagent-flow-task-1-text-1',
            text: '先检索',
          },
          {
            kind: 'grouped_tool_call',
            key: 'assistant-1-subagent-flow-task-1-tool-call-2',
            call: {
              type: 'tool_call',
              toolCallId: 'tool-1',
              title: 'Search',
              status: 'in_progress',
              taskToolCallId: 'task-1',
              subagentName: 'Worker',
            },
          },
          {
            kind: 'grouped_text',
            key: 'assistant-1-subagent-flow-task-1-text-3',
            text: '再总结',
          },
        ],
        resultBlocks: [],
      },
    ]);
  });
});
