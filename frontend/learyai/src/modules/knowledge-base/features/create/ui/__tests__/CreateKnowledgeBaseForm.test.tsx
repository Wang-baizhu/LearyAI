import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
}));

vi.mock('@/app/store/hooks', () => ({
  useAppDispatch: () => mocks.dispatch,
}));

vi.mock('@leary/tour-guide', () => ({
  TourOverlay: () => <div data-testid="tour-overlay" />,
  TourProvider: ({
    children,
    tags,
  }: {
    children: React.ReactNode;
    tags?: string[];
  }) => (
    <div data-testid="tour-provider" data-tags={tags?.join(',') ?? ''}>
      {children}
    </div>
  ),
}));

vi.mock('../../../index', () => ({
  default: ({
    createKnowledgeBaseGuideTag,
    defaultProjectId,
    isSubmitting,
    projectFieldGuideActionLabel,
    projectFieldGuideContent,
    projectFieldGuideOrder,
    projectFieldGuideTitle,
    projects,
    projectsErrorMessage,
    projectsLoading,
    requireProject,
    submitLabel,
  }: {
    defaultProjectId?: string | null;
    isSubmitting?: boolean;
    projectFieldGuideActionLabel?: string;
    projectFieldGuideContent?: React.ReactNode;
    projectFieldGuideOrder?: number;
    projectFieldGuideTitle?: string;
    projects?: Array<{ projectId: string; name: string }>;
    projectsErrorMessage?: string | null;
    projectsLoading?: boolean;
    requireProject?: boolean;
    submitLabel: string;
    createKnowledgeBaseGuideTag?: string;
  }) => (
    <div
      data-testid="knowledge-base-form"
      data-guide-tag={createKnowledgeBaseGuideTag ?? ''}
      data-default-project={defaultProjectId ?? ''}
      data-guide-action={projectFieldGuideActionLabel ?? ''}
      data-guide-content={typeof projectFieldGuideContent === 'string' ? projectFieldGuideContent : 'node'}
      data-guide-order={projectFieldGuideOrder ?? ''}
      data-guide-title={projectFieldGuideTitle ?? ''}
      data-project-count={projects?.length ?? 0}
      data-projects-error={projectsErrorMessage ?? ''}
      data-projects-loading={String(Boolean(projectsLoading))}
      data-require-project={String(Boolean(requireProject))}
      data-submit-label={submitLabel}
      data-submitting={String(Boolean(isSubmitting))}
      data-plugin-project-id={defaultProjectId ?? ''}
    />
  ),
}));

import CreateKnowledgeBaseForm from '../CreateKnowledgeBaseForm';

describe('CreateKnowledgeBaseForm', () => {
  it('会把提交态和引导配置传给复用表单', () => {
    const html = renderToStaticMarkup(
      <CreateKnowledgeBaseForm
        mutation={{
          isPending: true,
          isError: false,
          isSuccess: false,
        } as never}
        onSubmit={vi.fn()}
        defaultProjectId="project-1"
        projects={[{ projectId: 'project-1', name: '主空间' }]}
        projectFieldGuideActionLabel="知道了"
        projectFieldGuideContent="选择所属空间"
        projectFieldGuideOrder={4}
        projectFieldGuideTitle="所属空间"
        createKnowledgeBaseGuideTag="guide:kb:create:test"
      />
    );

    expect(html).toContain('data-testid="tour-provider"');
    expect(html).toContain('data-tags="guide:kb:create:test"');
    expect(html).toContain('data-testid="knowledge-base-form"');
    expect(html).toContain('data-guide-tag="guide:kb:create:test"');
    expect(html).toContain('data-submitting="true"');
    expect(html).toContain('data-submit-label="创建知识库"');
    expect(html).toContain('data-require-project="true"');
    expect(html).toContain('data-project-count="1"');
    expect(html).toContain('data-plugin-project-id="project-1"');
    expect(html).toContain('data-guide-order="4"');
    expect(html).toContain('data-guide-title="所属空间"');
    expect(html).toContain('data-guide-action="知道了"');
    expect(html).toContain('data-testid="tour-overlay"');
  });
});
