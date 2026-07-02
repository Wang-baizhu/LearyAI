import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/ui/LoadingSpinner', () => ({
  default: ({ label = '加载中...' }: { label?: string }) => (
    <span data-testid="spinner">{label}</span>
  ),
}));

import RenameProjectForm from '../RenameProjectForm';

describe('RenameProjectForm', () => {
  it('会渲染已有名称并展示提交中的状态', () => {
    const html = renderToStaticMarkup(
      <RenameProjectForm
        defaultName="默认项目"
        isSubmitting
        onSubmit={vi.fn()}
      />
    );

    expect(html).toContain('空间名称');
    expect(html).toContain('例如：默认项目');
    expect(html).toContain('value="默认项目"');
    expect(html).toContain('提交中...');
    expect(html).toContain('disabled');
  });
});
