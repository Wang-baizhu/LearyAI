import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MessageRoleRenderer from '../MessageRoleRenderer';

vi.mock('../ContentBlockRenderer', () => ({
  default: ({ block }: { block: { kind: string } }) => <div>content-block:{block.kind}</div>,
}));

vi.mock('../AIMessageContent', () => ({
  default: ({ text }: { text: string }) => <div>ai-message:{text}</div>,
}));

vi.mock('../UserMessageContent', () => ({
  default: ({ text }: { text: string }) => <div>user-message:{text}</div>,
}));

vi.mock('../../tools', () => ({
  ToolCallGroup: ({
    call,
    result,
  }: {
    call: { title: string };
    result: { result: string };
  }) => <div>tool-group:{call.title}:{result.result}</div>,
}));

vi.mock('@/shared/ui/icons/MaterialIcon', () => ({
  default: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock('../SubagentActivity', () => ({
  default: ({
    name,
    status,
    flowChildren,
    resultChildren,
  }: {
    name: string;
    status: string;
    flowChildren: React.ReactNode;
    resultChildren: React.ReactNode;
  }) => (
    <section>
      subagent:{name}:{status}
      {flowChildren}
      {resultChildren}
    </section>
  ),
}));

describe('MessageRoleRenderer', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn(),
      },
    });
  });

  it('renders assistant render blocks safely', () => {
    const render = () =>
      renderToStaticMarkup(
        <MessageRoleRenderer
          message={{
            id: 'assistant-1',
            sender: 'assistant',
            blocks: [
              {
                kind: 'text',
                key: 'assistant-1-text-0',
                text: '这里是回答。',
                copyText: '这里是回答。',
                saveText: '这里是回答。',
              },
              {
                kind: 'thinking',
                key: 'assistant-1-thinking-0',
                text: '思考中',
              },
              {
                kind: 'tool_group',
                key: 'assistant-1-tool-group-0',
                call: {
                  type: 'tool_call',
                  toolCallId: 'tool-1',
                  title: '搜索文档',
                  status: 'succeeded',
                },
                result: {
                  type: 'tool_result',
                  toolCallId: 'tool-1',
                  result: '命中结果',
                },
              },
              {
                kind: 'subagent_group',
                key: 'assistant-1-subagent-0',
                name: 'Worker',
                status: 'end',
                description: '处理中',
                hasResult: true,
                flowBlocks: [
                  {
                    kind: 'text',
                    key: 'assistant-1-flow-text-0',
                    text: '中间过程',
                    copyText: '中间过程',
                    saveText: '中间过程',
                  },
                ],
                resultBlocks: [
                  {
                    kind: 'text',
                    key: 'assistant-1-result-text-0',
                    text: '最终结果',
                    copyText: '最终结果',
                    saveText: '最终结果',
                  },
                ],
              },
            ],
          }}
        />
      );

    expect(render).not.toThrow();
    const markup = render();
    expect(markup).toContain('ai-message:这里是回答。');
    expect(markup).toContain('content-block:thinking');
    expect(markup).toContain('tool-group:搜索文档:命中结果');
    expect(markup).toContain('subagent:Worker:end');
    expect(markup).toContain('ai-message:中间过程');
    expect(markup).toContain('ai-message:最终结果');
    expect(markup).toContain('保存');
    expect(markup).toContain('复制');
  });

  it('renders system messages as centered bubbles', () => {
    const markup = renderToStaticMarkup(
      <MessageRoleRenderer
        message={{
          id: 'system-1',
          sender: 'system',
          blocks: [
            {
              kind: 'text',
              key: 'system-1-text-0',
              text: '连接已恢复',
              copyText: '连接已恢复',
              saveText: '连接已恢复',
            },
          ],
        }}
      />
    );

    expect(markup).toContain('连接已恢复');
    expect(markup).toContain('ai-message:连接已恢复');
  });

  it('renders assistant save button as disabled text action when no save callback is provided', () => {
    const markup = renderToStaticMarkup(
      <MessageRoleRenderer
        message={{
          id: 'assistant-2',
          sender: 'assistant',
          blocks: [
            {
              kind: 'text',
              key: 'assistant-2-text-0',
              text: '保存这段文本',
              copyText: '保存这段文本',
              saveText: '保存这段文本',
            },
          ],
        }}
      />
    );

    expect(markup).toContain('保存');
    expect(markup).toContain('disabled');
  });
});
