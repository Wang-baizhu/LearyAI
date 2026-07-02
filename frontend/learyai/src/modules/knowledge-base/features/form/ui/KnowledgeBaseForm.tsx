// KnowledgeBaseForm 负责复用知识库表单的输入与提交。
import React, { useEffect, useMemo, useState } from 'react';
import type { Project } from '../../../../project';
import type { KnowledgeBaseVisibility } from '../../../entities';
import LoadingSpinner from '@/shared/ui/LoadingSpinner';
import { TourStep } from '@leary/tour-guide';

export interface KnowledgeBaseFormValues {
  name?: string;
  description?: string | null;
  tags?: string[];
  visibility?: KnowledgeBaseVisibility;
}

export interface KnowledgeBaseFormPayload {
  name: string;
  description?: string | null;
  tags?: string[];
  projectId?: string;
  visibility: KnowledgeBaseVisibility;
}

interface KnowledgeBaseFormProps {
  initialValues?: KnowledgeBaseFormValues | null;
  isSubmitting?: boolean;
  projects?: Project[];
  defaultProjectId?: string | null;
  requireProject?: boolean;
  projectsLoading?: boolean;
  projectsErrorMessage?: string | null;
  createKnowledgeBaseGuideTag?: string;
  projectFieldGuideOrder?: number;
  projectFieldGuideTitle?: string;
  projectFieldGuideContent?: React.ReactNode;
  projectFieldGuideActionLabel?: string;
  submitLabel: string;
  onSubmit: (payload: KnowledgeBaseFormPayload) => void;
}

const KnowledgeBaseForm: React.FC<KnowledgeBaseFormProps> = ({
  initialValues,
  isSubmitting = false,
  projects,
  defaultProjectId,
  requireProject = false,
  projectsLoading = false,
  projectsErrorMessage = null,
  createKnowledgeBaseGuideTag,
  projectFieldGuideOrder,
  projectFieldGuideTitle,
  projectFieldGuideContent,
  projectFieldGuideActionLabel,
  submitLabel,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [projectId, setProjectId] = useState('');
  const [visibility, setVisibility] = useState<KnowledgeBaseVisibility>('PRIVATE');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setName(initialValues?.name ?? '');
      setDescription(initialValues?.description ?? '');
      setTags((initialValues?.tags ?? []).join(', '));
      setVisibility(initialValues?.visibility ?? 'PRIVATE');
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialValues]);

  useEffect(() => {
    if (!requireProject) {
      return;
    }
    if (!projectId && defaultProjectId) {
      const timer = window.setTimeout(() => setProjectId(defaultProjectId), 0);
      return () => window.clearTimeout(timer);
    }
  }, [defaultProjectId, projectId, requireProject]);

  const parsedTags = useMemo(() => {
    if (!tags.trim()) {
      return [];
    }
    return tags
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
  }, [tags]);

  const canSubmit =
    name.trim().length > 0 && !isSubmitting && (!requireProject || projectId.trim().length > 0);

  const projectFieldNode = (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-2">所属空间</label>
      <select
        className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60"
        value={projectId}
        onChange={(event) => setProjectId(event.target.value)}
        disabled={projectsLoading || (projects?.length ?? 0) === 0}
      >
        <option value="" disabled>
          {projectsLoading ? '项目空间加载中...' : '请选择空间'}
        </option>
        {(projects ?? []).map((project) => (
          <option key={project.projectId} value={project.projectId}>
            {project.name}
          </option>
        ))}
      </select>
      {projectsErrorMessage ? (
        <p className="text-xs text-rose-500 mt-2">{projectsErrorMessage}</p>
      ) : null}
      {!projectsLoading && (projects?.length ?? 0) === 0 ? (
        <p className="text-xs text-slate-400 mt-2">暂无项目空间，请先新建项目空间</p>
      ) : null}
    </div>
  );
  const guidedProjectFieldNode =
    requireProject && createKnowledgeBaseGuideTag && typeof projectFieldGuideOrder === 'number' ? (
      <TourStep
        tag={createKnowledgeBaseGuideTag}
        order={projectFieldGuideOrder}
        title={projectFieldGuideTitle ?? '所属空间'}
        content={projectFieldGuideContent ?? '这里用于选择知识库所属空间。'}
        actionLabel={projectFieldGuideActionLabel ?? '知道了'}
      >
        {projectFieldNode}
      </TourStep>
    ) : (
      projectFieldNode
    );
  const visibilityFieldNode = (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-2">可见性</label>
      <select
        className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-accent"
        value={visibility}
        onChange={(event) => setVisibility(event.target.value as KnowledgeBaseVisibility)}
      >
        <option value="PRIVATE">私有</option>
        <option value="TEAM">团队</option>
        <option value="PUBLIC">公开</option>
      </select>
    </div>
  );
  const guidedVisibilityFieldNode =
    requireProject &&
    createKnowledgeBaseGuideTag &&
    typeof projectFieldGuideOrder === 'number' ? (
      <TourStep
        tag={createKnowledgeBaseGuideTag}
        order={projectFieldGuideOrder + 1}
        title="可见性"
        content="这里用于设置知识库可见范围。"
        actionLabel="知道了"
      >
        {visibilityFieldNode}
      </TourStep>
    ) : (
      visibilityFieldNode
    );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    onSubmit({
      name: name.trim(),
      description: description.trim() ? description.trim() : null,
      tags: parsedTags,
      projectId: projectId.trim() ? projectId.trim() : undefined,
      visibility,
    });
  };

  return (
    <form className="flex max-h-[calc(100dvh-12rem)] min-h-0 flex-col" onSubmit={handleSubmit}>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1 pb-4">
        {requireProject ? guidedProjectFieldNode : null}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-2">知识库名称</label>
          <input
            className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-accent"
            placeholder="例如：项目知识库"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-2">描述</label>
          <textarea
            className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-accent min-h-[96px]"
            placeholder="简要说明该知识库用途"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>{guidedVisibilityFieldNode}</div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2">标签（用英文逗号分隔）</label>
            <input
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="AI, 文档, 运营"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="shrink-0 border-t border-slate-200 pt-4 dark:border-slate-700">
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-2xl bg-primary text-white text-sm font-semibold py-3 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-primary/20 transition-all flex items-center justify-center"
        >
          {isSubmitting ? <LoadingSpinner label="提交中..." /> : submitLabel}
        </button>
      </div>
    </form>
  );
};

export default KnowledgeBaseForm;
