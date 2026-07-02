import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
}));

vi.mock('@/app/store/hooks', () => ({
  useAppDispatch: () => mocks.dispatch,
}));

vi.mock('../../../index', () => ({
  default: ({
    initialValues,
    isSubmitting,
    submitLabel,
    defaultProjectId,
  }: {
      initialValues?: {
        name?: string;
        description?: string | null;
        tags?: string[];
        visibility?: string;
        enabledTemplatePluginIds?: string[];
      };
    isSubmitting?: boolean;
    submitLabel: string;
    defaultProjectId?: string;
  }) => (
    <div
      data-testid="knowledge-base-form"
      data-initial-name={initialValues?.name ?? ''}
      data-initial-description={initialValues?.description ?? ''}
      data-initial-tags={initialValues?.tags?.join(',') ?? ''}
      data-initial-visibility={initialValues?.visibility ?? ''}
      data-default-project={defaultProjectId ?? ''}
      data-submit-label={submitLabel}
      data-submitting={String(Boolean(isSubmitting))}
    />
  ),
}));

import EditKnowledgeBaseForm from '../EditKnowledgeBaseForm';

describe('EditKnowledgeBaseForm', () => {
  it('会把已有知识库信息和提交态传给复用表单', () => {
    const html = renderToStaticMarkup(
      <EditKnowledgeBaseForm
        knowledgeBase={{
          kbId: 'kb-1',
          name: '核心知识库',
          description: '资料沉淀',
          tags: ['产品', '运营'],
          visibility: 'TEAM',
          userId: 1,
        }}
        projectId="project-1"
        mutation={{
          isPending: true,
          isError: false,
          isSuccess: false,
        } as never}
        onSubmit={vi.fn()}
      />
    );

    expect(html).toContain('data-testid="knowledge-base-form"');
    expect(html).toContain('data-initial-name="核心知识库"');
    expect(html).toContain('data-initial-description="资料沉淀"');
    expect(html).toContain('data-initial-tags="产品,运营"');
    expect(html).toContain('data-initial-visibility="TEAM"');
    expect(html).toContain('data-default-project="project-1"');
    expect(html).toContain('data-submit-label="保存修改"');
    expect(html).toContain('data-submitting="true"');
  });
});
