// ResourceGenerateTaskModal 负责生成导图/题目/关系图任务的上下文确认与创建。
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatUrlDisplayName } from '@/shared/lib/formatters';
import { Modal } from '@leary/ui';
import { ErrorDialog } from '@leary/ui';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';
import type { ResourceOptionItem } from '../../../../kbdoc';
import { resolveDocReferenceState, resourceFlowCanvasApi } from '../../../../resource';
import { taskApi } from '../../../entities';
import type { TaskCreateRequest } from '../../../entities';
import { mergeGeneratePromptVars } from '../lib/mergeGeneratePromptVars';

const KBVIEW_PLUGIN_UUID = '44444444-4444-4444-4444-444444444444';

interface GeneratePluginSummary {
  displayName: string;
  resourceLabel: string;
  generateLabel: string;
  iconKey: string;
}

interface ResourceGenerateTaskModalProps {
  isOpen: boolean;
  type: string | 'kbview';
  plugin?: GeneratePluginSummary | null;
  resources: ResourceOptionItem[];
  promptVars?: Record<string, string>;
  projectId?: string;
  kbId?: string;
  isLoading?: boolean;
  onClose: () => void;
}

const KBVIEW_CONFIG = {
  title: '生成关系图',
  label: '关系图',
  info: '准备生成关系图',
  icon: 'hub',
};

const buildKbviewInfo = (
  catalog?: Awaited<ReturnType<typeof resourceFlowCanvasApi.getResourceCatalog>>
) => {
  if (!catalog) {
    return '';
  }
  const docLines = catalog.docs.map((item, index) => {
    const suffix = item.status ? `（状态：${item.status}）` : '';
    return `${index + 1}. ${item.docId} | ${item.name}${suffix}`;
  });
  const templateLines = catalog.templates.map((item, index) => {
    const details = [item.pluginId, item.visibility].filter(Boolean).join(' / ');
    const suffix = details ? `（${details}）` : '';
    return `${index + 1}. ${item.templateId} | ${item.name}${suffix}`;
  });

  return [
    '以下是当前知识库可用的轻量资源信息，请在生成关系图时优先参考：',
    '',
    '文档列表：',
    docLines.length > 0 ? docLines.join('\n') : '无',
    '',
    '模板列表：',
    templateLines.length > 0 ? templateLines.join('\n') : '无',
  ].join('\n');
};

const ResourceGenerateTaskModal: React.FC<ResourceGenerateTaskModalProps> = ({
  isOpen,
  type,
  plugin,
  resources,
  promptVars,
  projectId,
  kbId,
  isLoading = false,
  onClose,
}) => {
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [hasTouched, setHasTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const config = type === 'kbview'
    ? KBVIEW_CONFIG
    : {
      title: plugin?.generateLabel ?? '生成模板',
      label: plugin?.resourceLabel ?? plugin?.displayName ?? '模板',
      info: `准备生成${plugin?.resourceLabel ?? plugin?.displayName ?? '模板'}`,
      icon: plugin?.iconKey ?? 'extension',
    };
  const isKbview = type === 'kbview';
  const kbviewCatalogQuery = useQuery({
    queryKey: ['task', 'kbview-resource-catalog', projectId ?? 'none', kbId ?? 'none'],
    queryFn: () => resourceFlowCanvasApi.getResourceCatalog(projectId as string, kbId as string),
    enabled: isOpen && isKbview && Boolean(projectId) && Boolean(kbId),
  });

  const defaultSelectedIds = useMemo(
    () =>
      resources
        .filter((item) =>
          resolveDocReferenceState({
            projectId,
            kbId,
            docId: item.docId,
            status: item.status,
          })
        )
        .map((item) => item.docId),
    [kbId, projectId, resources]
  );

  const effectiveSelectedDocIds = hasTouched ? selectedDocIds : defaultSelectedIds;

  const selectedDocRefs = useMemo(
    () =>
      resources
        .filter((item) => effectiveSelectedDocIds.includes(item.docId))
        .map((item) => ({ id: item.docId, name: item.name })),
    [effectiveSelectedDocIds, resources]
  );

  const handleToggle = (item: ResourceOptionItem) => {
    if (item.status !== 'DONE') return;
    const currentSelectedIds = hasTouched ? selectedDocIds : defaultSelectedIds;
    const nextSelectedIds = currentSelectedIds.includes(item.docId)
      ? currentSelectedIds.filter((id) => id !== item.docId)
      : [...currentSelectedIds, item.docId];
    setHasTouched(true);
    setSelectedDocIds(nextSelectedIds);
  };

  const handleSubmit = async () => {
    if (!projectId || !kbId) {
      setErrorMessage('缺少项目或知识库信息，无法创建任务。');
      return;
    }
    if (isKbview && kbviewCatalogQuery.isLoading) {
      setErrorMessage('正在补齐知识库轻量信息，请稍后再试。');
      return;
    }
    if (isKbview && kbviewCatalogQuery.isError) {
      setErrorMessage('知识库轻量信息加载失败，暂时无法生成关系图。');
      return;
    }
    const pipelineContext: NonNullable<TaskCreateRequest['pipelineContext']> = isKbview
      ? {
          templateId: '_',
          pluginId: KBVIEW_PLUGIN_UUID,
        }
      : {
          templateId: '_',
          pluginId: type,
        };
    if (isKbview) {
      pipelineContext.info = buildKbviewInfo(kbviewCatalogQuery.data);
    } else {
      pipelineContext.docRefs = selectedDocRefs;
    }
    const mergedPromptVars = mergeGeneratePromptVars(promptVars, customPrompt);
    if (mergedPromptVars) {
      pipelineContext.promptVars = mergedPromptVars;
    }
    const payload: TaskCreateRequest = {
      projectId,
      kbId,
      type: isKbview ? 'agent_pipeline' : 'template_pipeline',
      typeId: '_',
      status: 'PROCESSING',
      pipelineContext,
      info: isKbview ? undefined : config.info,
      changeType: 'status_snapshot',
    };

    try {
      setIsSubmitting(true);
      await taskApi.createTask(payload);
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : '创建任务失败，请稍后重试。';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        title={config.title}
        onClose={() => {
          if (isSubmitting) return;
          onClose();
        }}
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="resource-generate-custom-prompt" className="text-sm font-semibold text-slate-800 dark:text-[#e0e0e0]">
                自定义补充要求
              </label>
              {!isKbview && (
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>当前已选 {selectedDocRefs.length} 条引用</span>
                </div>
              )}
            </div>
            <textarea
              id="resource-generate-custom-prompt"
              value={customPrompt}
              onChange={(event) => setCustomPrompt(event.target.value)}
              rows={4}
              placeholder={`例如：请更关注${config.label}的层次结构、难度分布或输出风格。`}
              className="w-full rounded-2xl border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a] px-4 py-3 text-sm text-slate-700 dark:text-[#e0e0e0] outline-none transition-colors placeholder:text-slate-400 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 resize-y min-h-[108px]"
            />
          </div>

          {isKbview ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white dark:bg-[#1a1a1a] px-4 py-4 text-xs text-slate-500 dark:text-[#c7d8db] space-y-2">
              <div className="font-semibold text-slate-700 dark:text-[#e0e0e0]">知识库轻量上下文</div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200">
                当前关系图生成入口仅知识库 owner 可用，非 owner 提交后会因权限限制失败；该入口后续会迁移。
              </div>
              {kbviewCatalogQuery.isLoading ? (
                <div>正在按需加载当前知识库的文档与模板轻量信息...</div>
              ) : kbviewCatalogQuery.isError ? (
                <div>轻量信息加载失败，当前无法提交关系图任务。</div>
              ) : (
                <div>
                  已补齐 {kbviewCatalogQuery.data?.docs.length ?? 0} 条文档、{kbviewCatalogQuery.data?.templates.length ?? 0} 条模板轻量信息；
                  提交后会作为任务补充上下文下发给后端。
                </div>
              )}
            </div>
          ) : (
            <div className="max-h-[320px] overflow-y-auto custom-scrollbar space-y-2">
              {isLoading && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-xs text-slate-400">
                  正在加载知识库资源...
                </div>
              )}
              {!isLoading && resources.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-xs text-slate-400">
                  当前没有可选的知识库资源
                </div>
              )}
              {!isLoading &&
                resources.map((item) => {
                  const isSelected = effectiveSelectedDocIds.includes(item.docId);
                  const isDisabled = item.status !== 'DONE';
                  const statusLabel = isDisabled ? '处理中' : isSelected ? '已引用' : '未引用';
                  const displayName = formatUrlDisplayName(item.name);
                  return (
                    <button
                      key={item.docId}
                      type="button"
                      onClick={() => handleToggle(item)}
                      disabled={isDisabled}
                      className={`w-full text-left rounded-2xl border px-4 py-3 transition-all flex items-center gap-3 ${
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-slate-100 dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a] hover:border-primary/30 dark:hover:border-primary/40'
                      } ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <div
                        className={`size-8 rounded-xl flex items-center justify-center ${
                          isSelected
                            ? 'bg-primary text-white'
                            : 'bg-slate-100 dark:bg-[#121212] text-slate-400 dark:text-[#a0a0a0]'
                        }`}
                      >
                        <MaterialIcon name="description" className="text-[16px]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-sm font-semibold text-slate-800 dark:text-[#e0e0e0] truncate"
                          title={item.name}
                        >
                          {displayName}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-[#c7d8db]">
                        <span>{statusLabel}</span>
                        {isSelected && (
                          <span className="size-5 rounded-full bg-primary text-white flex items-center justify-center">
                            <MaterialIcon name="check" className="text-[12px]" />
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold rounded-full border border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || (isKbview && (kbviewCatalogQuery.isLoading || kbviewCatalogQuery.isError))}
              className="px-5 py-2 text-xs font-semibold rounded-full bg-primary text-white shadow-md shadow-primary/30 transition-transform active:scale-95 disabled:opacity-60"
            >
              {isSubmitting ? '创建中...' : '确认生成'}
            </button>
          </div>
        </div>
      </Modal>
      <ErrorDialog
        isOpen={Boolean(errorMessage)}
        message={errorMessage ?? ''}
        onConfirm={() => setErrorMessage(null)}
      />
    </>
  );
};

export default ResourceGenerateTaskModal;
