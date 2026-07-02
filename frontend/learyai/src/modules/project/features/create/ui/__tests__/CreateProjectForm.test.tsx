import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/app/store/hooks', () => ({
  useAppDispatch: () => vi.fn(),
}));

vi.mock('@/shared/ui/LoadingSpinner', () => ({
  default: ({ label = '加载中...' }: { label?: string }) => (
    <span data-testid="spinner">{label}</span>
  ),
}));

import CreateProjectForm from '../CreateProjectForm';

describe('CreateProjectForm', () => {
  it('会渲染空间创建表单并展示提交中的状态', () => {
    const html = renderToStaticMarkup(
      <CreateProjectForm
        mutation={{
          isPending: true,
          isError: false,
          isSuccess: false,
        } as never}
        onSubmit={vi.fn()}
      />
    );

    expect(html).toContain('空间名称');
    expect(html).toContain('例如：个人项目空间');
    expect(html).toContain('提交中...');
    expect(html).toContain('disabled');
  });
});
