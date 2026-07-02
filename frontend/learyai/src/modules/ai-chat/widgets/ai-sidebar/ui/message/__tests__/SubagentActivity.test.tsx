// @vitest-environment jsdom
// SubagentActivity.test.tsx 负责验证子 agent 完成态下的默认页签与手动切换行为。
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import SubagentActivity from '../SubagentActivity';

vi.mock('@/shared/ui/icons/MaterialIcon', () => ({
  default: ({ name }: { name: string }) => <span>{name}</span>,
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('SubagentActivity', () => {
  it('在完成后默认展示结果，但仍允许切回流程', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <SubagentActivity
          name="explorer"
          status="update"
          description="内部嵌套查询大纲"
          hasResult
          flowChildren={<div>流程内容</div>}
          resultChildren={<div>结果内容</div>}
        />
      );
    });

    expect(container.textContent).toContain('流程内容');
    expect(container.textContent).not.toContain('结果内容');

    await act(async () => {
      root.render(
        <SubagentActivity
          name="explorer"
          status="end"
          description="内部嵌套查询大纲"
          hasResult
          flowChildren={<div>流程内容</div>}
          resultChildren={<div>结果内容</div>}
        />
      );
    });

    expect(container.textContent).toContain('结果内容');
    expect(container.textContent).not.toContain('流程内容');

    const flowButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === '流程'
    );
    expect(flowButton).not.toBeUndefined();

    await act(async () => {
      flowButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('流程内容');
    expect(container.textContent).not.toContain('结果内容');

    await act(async () => {
      root.unmount();
    });
  });
});
