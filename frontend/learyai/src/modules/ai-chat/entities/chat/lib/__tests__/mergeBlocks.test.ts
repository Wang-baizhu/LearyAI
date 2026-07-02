// mergeBlocks.test.ts 负责验证 AI Chat 消息 block 的纯合并逻辑。
import { describe, expect, it } from 'vitest';
import { mergeMessageBlocks } from '../mergeBlocks';
import type { ChatMessage } from '../../model/types/schema';

describe('mergeMessageBlocks', () => {
  it('会合并连续的 text block', () => {
    const existing: ChatMessage['blocks'] = [{ type: 'text', text: '你好，' }];
    const incoming: ChatMessage['blocks'] = [{ type: 'text', text: '世界' }];

    expect(mergeMessageBlocks(existing, incoming)).toEqual([{ type: 'text', text: '你好，世界' }]);
  });

  it('会在 text block 存在重叠前缀时只追加新增尾部', () => {
    const existing: ChatMessage['blocks'] = [{ type: 'text', text: '当前知识库的大纲如下：\n\n### 目录结构\n- 第五圈药品使用' }];
    const incoming: ChatMessage['blocks'] = [
      {
        type: 'text',
        text: '提示 ([1][doc])\n\n## 参考\n- 参考文档',
      },
    ];

    expect(mergeMessageBlocks(existing, incoming)).toEqual([
      {
        type: 'text',
        text: '当前知识库的大纲如下：\n\n### 目录结构\n- 第五圈药品使用提示 ([1][doc])\n\n## 参考\n- 参考文档',
      },
    ]);
  });

  it('会在服务端发送累计文本时避免重复拼接已有前缀', () => {
    const existing: ChatMessage['blocks'] = [{ type: 'text', text: 'abc' }];
    const incoming: ChatMessage['blocks'] = [{ type: 'text', text: 'abcdef' }];

    expect(mergeMessageBlocks(existing, incoming)).toEqual([{ type: 'text', text: 'abcdef' }]);
  });

  it('会在流式表格行与分隔线之间补上丢失的换行，避免破坏 GFM 表格结构', () => {
    const existing: ChatMessage['blocks'] = [{ type: 'text', text: '| 分类 | 页码 | 说明 |' }];
    const incoming: ChatMessage['blocks'] = [
      {
        type: 'text',
        text: '|------|------|------|\n| 第1类 | 1-2 | 核心词汇 |',
      },
    ];

    expect(mergeMessageBlocks(existing, incoming)).toEqual([
      {
        type: 'text',
        text: '| 分类 | 页码 | 说明 |\n|------|------|------|\n| 第1类 | 1-2 | 核心词汇 |',
      },
    ]);
  });

  it('会在表格分隔线与后续数据行之间补上丢失的换行', () => {
    const existing: ChatMessage['blocks'] = [{ type: 'text', text: '| 分类 | 页码 | 说明 |\n|------|------|------|' }];
    const incoming: ChatMessage['blocks'] = [{ type: 'text', text: '| 第1类 | 1-2 | 核心词汇 |' }];

    expect(mergeMessageBlocks(existing, incoming)).toEqual([
      {
        type: 'text',
        text: '| 分类 | 页码 | 说明 |\n|------|------|------|\n| 第1类 | 1-2 | 核心词汇 |',
      },
    ]);
  });

  it('会在流式表格 chunk 携带重复表头前缀时先去重再补换行', () => {
    const existing: ChatMessage['blocks'] = [{ type: 'text', text: '| 分类 | 页码 | 说明 |' }];
    const incoming: ChatMessage['blocks'] = [
      {
        type: 'text',
        text: '| 分类 | 页码 | 说明 |\n|------|------|------|\n| 第1类 | 1-2 | 核心词汇 |',
      },
    ];

    expect(mergeMessageBlocks(existing, incoming)).toEqual([
      {
        type: 'text',
        text: '| 分类 | 页码 | 说明 |\n|------|------|------|\n| 第1类 | 1-2 | 核心词汇 |',
      },
    ]);
  });

  it('会合并连续的 thinking block', () => {
    const existing: ChatMessage['blocks'] = [{ type: 'thinking', text: '先分析' }];
    const incoming: ChatMessage['blocks'] = [{ type: 'thinking', text: '后输出' }];

    expect(mergeMessageBlocks(existing, incoming)).toEqual([
      { type: 'thinking', text: '先分析后输出' },
    ]);
  });

  it('会按 toolCallId 合并 tool_call，并在完成时补 tool_result', () => {
    const existing: ChatMessage['blocks'] = [
      {
        type: 'tool_call',
        toolCallId: 'call-1',
        title: '搜索',
        status: 'in_progress',
        args: '{"query":"foo"}',
      },
    ];
    const incoming: ChatMessage['blocks'] = [
      {
        type: 'tool_call',
        toolCallId: 'call-1',
        title: '',
        status: 'succeeded',
        args: '{"result":"bar"}',
        subagentName: 'researcher',
        taskToolCallId: 'task-1',
      },
    ];

    expect(mergeMessageBlocks(existing, incoming)).toEqual([
      {
        type: 'tool_call',
        toolCallId: 'call-1',
        title: '搜索',
        status: 'succeeded',
        args: '{"query":"foo"}',
        subagentName: 'researcher',
        taskToolCallId: 'task-1',
      },
      {
        type: 'tool_result',
        toolCallId: 'call-1',
        result: '{"result":"bar"}',
        status: 'succeeded',
      },
    ]);
  });

  it('会把 tool_result 移动到对应 tool_call 后面并同步调用状态', () => {
    const existing: ChatMessage['blocks'] = [
      { type: 'text', text: '前置说明' },
      {
        type: 'tool_call',
        toolCallId: 'call-1',
        title: '检索资料',
        status: 'in_progress',
      },
      { type: 'text', text: '后置说明' },
    ];
    const incoming: ChatMessage['blocks'] = [
      {
        type: 'tool_result',
        toolCallId: 'call-1',
        result: '命中结果',
        status: 'succeeded',
      },
    ];

    expect(mergeMessageBlocks(existing, incoming)).toEqual([
      { type: 'text', text: '前置说明' },
      {
        type: 'tool_call',
        toolCallId: 'call-1',
        title: '检索资料',
        status: 'succeeded',
      },
      {
        type: 'tool_result',
        toolCallId: 'call-1',
        result: '命中结果',
        status: 'succeeded',
      },
      { type: 'text', text: '后置说明' },
    ]);
  });

  it('当只有 taskToolCallId 时，会把 tool_result 移到对应 subagent 区块后面', () => {
    const existing: ChatMessage['blocks'] = [
      {
        type: 'subagent',
        taskToolCallId: 'task-1',
        name: 'writer',
        status: 'begin',
        text: '开始执行',
      },
      { type: 'text', text: '收尾文本' },
    ];
    const incoming: ChatMessage['blocks'] = [
      {
        type: 'tool_result',
        toolCallId: 'call-2',
        taskToolCallId: 'task-1',
        result: '子任务结果',
        status: 'succeeded',
      },
    ];

    expect(mergeMessageBlocks(existing, incoming)).toEqual([
      {
        type: 'subagent',
        taskToolCallId: 'task-1',
        name: 'writer',
        status: 'begin',
        text: '开始执行',
      },
      {
        type: 'tool_result',
        toolCallId: 'call-2',
        taskToolCallId: 'task-1',
        result: '子任务结果',
        status: 'succeeded',
      },
      { type: 'text', text: '收尾文本' },
    ]);
  });

  it('会按 taskToolCallId 与状态合并 subagent update 文本', () => {
    const existing: ChatMessage['blocks'] = [
      {
        type: 'subagent',
        taskToolCallId: 'task-1',
        name: 'planner',
        status: 'update',
        text: '第一段',
      },
    ];
    const incoming: ChatMessage['blocks'] = [
      {
        type: 'subagent',
        taskToolCallId: 'task-1',
        name: '',
        status: 'update',
        text: '第二段',
      },
    ];

    expect(mergeMessageBlocks(existing, incoming)).toEqual([
      {
        type: 'subagent',
        taskToolCallId: 'task-1',
        name: 'planner',
        status: 'update',
        text: '第一段第二段',
      },
    ]);
  });

  it('会对 subagent update 文本做重叠去重，而不是简单重复拼接', () => {
    const existing: ChatMessage['blocks'] = [
      {
        type: 'subagent',
        taskToolCallId: 'task-1',
        name: 'planner',
        status: 'update',
        text: 'abc',
      },
    ];
    const incoming: ChatMessage['blocks'] = [
      {
        type: 'subagent',
        taskToolCallId: 'task-1',
        name: 'planner',
        status: 'update',
        text: 'abcdef',
      },
    ];

    expect(mergeMessageBlocks(existing, incoming)).toEqual([
      {
        type: 'subagent',
        taskToolCallId: 'task-1',
        name: 'planner',
        status: 'update',
        text: 'abcdef',
      },
    ]);
  });

  it('会把 task tool_result 插到同任务最后一个 subagent 后面，而不是第一个后面', () => {
    const existing: ChatMessage['blocks'] = [
      {
        type: 'subagent',
        taskToolCallId: 'task-1',
        name: 'writer',
        status: 'begin',
      },
      {
        type: 'subagent',
        taskToolCallId: 'task-1',
        name: 'writer',
        status: 'update',
        text: '处理中',
      },
      { type: 'text', text: '收尾文本' },
    ];
    const incoming: ChatMessage['blocks'] = [
      {
        type: 'tool_result',
        toolCallId: 'call-2',
        taskToolCallId: 'task-1',
        result: '子任务结果',
        status: 'succeeded',
      },
    ];

    expect(mergeMessageBlocks(existing, incoming)).toEqual([
      {
        type: 'subagent',
        taskToolCallId: 'task-1',
        name: 'writer',
        status: 'begin',
      },
      {
        type: 'subagent',
        taskToolCallId: 'task-1',
        name: 'writer',
        status: 'update',
        text: '处理中',
      },
      {
        type: 'tool_result',
        toolCallId: 'call-2',
        taskToolCallId: 'task-1',
        result: '子任务结果',
        status: 'succeeded',
      },
      { type: 'text', text: '收尾文本' },
    ]);
  });

  it('会按 toolCallId 合并 permission 请求', () => {
    const existing: ChatMessage['blocks'] = [
      {
        type: 'permission',
        toolCallId: 'perm-1',
        title: '原始标题',
        description: '原始描述',
        options: ['allow'],
        timeout: 10,
      },
    ];
    const incoming: ChatMessage['blocks'] = [
      {
        type: 'permission',
        toolCallId: 'perm-1',
        title: '更新标题',
        description: '更新描述',
        options: ['allow', 'deny'],
        timeout: 30,
      },
    ];

    expect(mergeMessageBlocks(existing, incoming)).toEqual([
      {
        type: 'permission',
        toolCallId: 'perm-1',
        title: '更新标题',
        description: '更新描述',
        options: ['allow', 'deny'],
        timeout: 30,
      },
    ]);
  });
});
