// TaskListButton 负责在资源中心头部展示最近任务的入口与预览面板。
import React, { useEffect, useRef, useState } from 'react';
import { useTaskList } from '../../../entities';
import type { TaskListItem, TaskStatus } from '../../../entities';
import { taskApi } from '../../../entities';
import { formatUrlDisplayName } from '@/shared/lib/formatters';
import LoadingSpinner from '@/shared/ui/LoadingSpinner';
import { Modal } from '@leary/ui';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';
import { useAppDispatch } from '@/app/store/hooks';
import { enqueueToast } from '@/app/store/ui/toastSlice';
import { useScopedDocNameMap } from '@/modules/resource';
import { resolveTaskPresentation, type TaskPluginSummary } from '../../../entities/core/model/taskPresentation';

const TASK_STATUS_META: Record<TaskStatus, { label: string; classes: string }> = {
  UPLOADING: { label: '上传中', classes: 'text-amber-500' },
  UPLOADED: { label: '已上传', classes: 'text-sky-500' },
  PROCESSING: { label: '处理中', classes: 'text-amber-600' },
  DONE: { label: '已完成', classes: 'text-emerald-500' },
  FAILED: { label: '失败', classes: 'text-rose-500' },
};

const formatTime = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const isInProgressStatus = (status: TaskStatus) =>
  status === 'UPLOADING' || status === 'UPLOADED' || status === 'PROCESSING';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const resolveText = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

const resolveDocRefs = (task: TaskListItem, docNameMap: Record<string, string>) => {
  const refs: Array<{ id?: string; name?: string }> = [];
  const pushRef = (raw: unknown) => {
    if (!isRecord(raw)) return;
    const id = resolveText(raw.id);
    const rawName = resolveText(raw.name);
    const mappedName = id ? resolveText(docNameMap[id]) : null;
    const name = rawName ?? mappedName ?? undefined;
    if (!id && !name) return;
    refs.push({ id: id ?? undefined, name });
  };

  const docRefs = task.viewData?.docRefs;
  if (Array.isArray(docRefs)) {
    docRefs.forEach((item) => pushRef(item));
  }

  if (refs.length > 0) {
    const uniqueRefs: Array<{ id?: string; name?: string }> = [];
    const seen = new Set<string>();
    refs.forEach((ref) => {
      const key = `${ref.id ?? ''}:${ref.name ?? ''}`;
      if (seen.has(key)) return;
      seen.add(key);
      uniqueRefs.push(ref);
    });
    return uniqueRefs;
  }
  if (task.type === 'document_pipeline' && task.typeId?.trim()) {
    return [{ id: task.typeId.trim(), name: resolveText(docNameMap[task.typeId.trim()]) ?? undefined }];
  }
  return [];
};

const formatDocRefs = (task: TaskListItem, docNameMap: Record<string, string>) => {
  const refs = resolveDocRefs(task, docNameMap);
  if (!refs.length) return null;
  const items = refs
    .map((ref) => ref.name ?? ref.id)
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => ({
      fullText: value,
      displayText: formatUrlDisplayName(value),
    }));
  if (!items.length) return null;
  return {
    fullText: items.map((item) => item.fullText).join('、'),
    displayText: items.map((item) => item.displayText).join('、'),
  };
};

const resolveTaskTitle = (task: TaskListItem, pluginById: Record<string, TaskPluginSummary>) => {
  const presentation = resolveTaskPresentation(task, pluginById);
  const pipelineLabel = presentation.pipelineLabel;
  const hasCurrentStage = typeof task.currentStage === 'string' && task.currentStage.trim().length > 0;
  const stageLabel = presentation.stageLabel;
  if (task.status === 'DONE') {
    return task.type === 'document_pipeline' ? `${pipelineLabel}处理完成` : `${pipelineLabel}生成完成`;
  }
  if (task.status === 'FAILED') {
    return task.type === 'document_pipeline' ? `${pipelineLabel}处理失败` : `${pipelineLabel}生成失败`;
  }
  if (hasCurrentStage && stageLabel) {
    return `${stageLabel}中...`;
  }
  if (task.status === 'UPLOADING') {
    return '正在上传文档...';
  }
  if (task.status === 'UPLOADED') {
    return '文档已上传，等待处理...';
  }
  if (task.type === 'document_pipeline') {
    return '正在处理文档中...';
  }
  return `正在生成${pipelineLabel}中...`;
};

const resolveTaskDetailLines = (task: TaskListItem, docNameMap: Record<string, string>) => {
  const docNames = formatDocRefs(task, docNameMap);
  const lines: Array<{ key: string; label: string; displayText: string; fullText: string }> = [];

  if (docNames) {
    lines.push({
      key: task.type === 'document_pipeline' ? 'document' : 'references',
      label: task.type === 'document_pipeline' ? '文档' : '参考文档',
      displayText: docNames.displayText,
      fullText: docNames.fullText,
    });
  }

  return lines;
};

interface TaskListButtonProps {
  projectId?: string;
  kbId?: string;
  compactOnMobile?: boolean;
}

interface TaskListPanelContentProps {
  items: TaskListItem[];
  isLoading: boolean;
  isError: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  docNameMap: Record<string, string>;
  pluginById: Record<string, TaskPluginSummary>;
  retryingTaskId: string | null;
  onRetryTask: (task: TaskListItem) => void | Promise<void>;
}

const TaskListPanelContent: React.FC<TaskListPanelContentProps> = ({
  items,
  isLoading,
  isError,
  isFetchingNextPage,
  hasNextPage,
  docNameMap,
  pluginById,
  retryingTaskId,
  onRetryTask,
}) => (
  <div className="space-y-3 text-xs text-slate-600 dark:text-slate-200">
    {isLoading ? (
      <div className="text-slate-400">正在加载任务...</div>
    ) : isError ? (
      <div className="text-rose-500">任务加载失败，请重试。</div>
    ) : items.length ? (
      items.map((task) => (
        <div
          key={task.taskId}
          className="flex items-start justify-between gap-3 rounded-2xl border border-slate-100 px-3 py-3 dark:border-[#2a2a2a]"
        >
          <div className="min-w-0 flex-1">
            <p
              className="line-clamp-2 break-words text-sm font-bold leading-5 text-slate-800 dark:text-white"
              title={resolveTaskTitle(task, pluginById)}
            >
              {resolveTaskTitle(task, pluginById)}
            </p>
            <div className="mt-1 space-y-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
              {resolveTaskDetailLines(task, docNameMap).map((line) => (
                <p
                  key={`${task.taskId}-${line.key}`}
                  className="line-clamp-2 break-words"
                  title={`${line.label}：${line.fullText}`}
                >
                  {line.label}：{line.displayText}
                </p>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">{formatTime(task.createdAt)}</p>
            {task.status === 'FAILED' && (
              <button
                type="button"
                disabled={retryingTaskId !== null}
                onClick={() => void onRetryTask(task)}
                className="mt-2 rounded-full border border-rose-200 px-2 py-1 text-[10px] font-bold tracking-[0.2em] text-rose-500 transition-colors hover:border-rose-300 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {retryingTaskId === task.taskId ? '重试中' : '重新处理'}
              </button>
            )}
          </div>
          <span
            className={`shrink-0 whitespace-nowrap text-[10px] font-black uppercase tracking-[0.3em] ${TASK_STATUS_META[task.status].classes}`}
          >
            {TASK_STATUS_META[task.status].label}
          </span>
        </div>
      ))
    ) : (
      <div className="text-slate-400">暂无待处理任务。</div>
    )}
    {!isLoading && !isError && items.length > 0 ? (
      <div className="py-1 text-center text-[11px] text-slate-400 dark:text-slate-500">
        {isFetchingNextPage ? '正在加载更多任务...' : hasNextPage ? '下滑加载更多' : '已加载全部任务'}
      </div>
    ) : null}
  </div>
);

const TaskListButton: React.FC<TaskListButtonProps> = ({
  projectId,
  kbId,
  compactOnMobile = false,
}) => {
  const dispatch = useAppDispatch();
  const docNameMap = useScopedDocNameMap({ projectId, kbId });
  const [open, setOpen] = useState(false);
  const [retryingTaskId, setRetryingTaskId] = useState<string | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(() => (
    typeof window !== 'undefined'
      ? window.matchMedia('(max-width: 767px)').matches
      : false
  ));
  const taskListQuery = useTaskList(
    {
      projectId,
      kbId,
      types: ['document_pipeline', 'template_pipeline', 'agent_pipeline'],
      statuses: ['UPLOADING', 'UPLOADED', 'PROCESSING', 'DONE', 'FAILED'],
      size: 20,
    },
    { enabled: Boolean(projectId && kbId) }
  );
  const {
    data,
    isLoading,
    isError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = taskListQuery;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current &&
        buttonRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobileViewport(event.matches);
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  const taskItems = data?.pages.flatMap((page) => page.items) ?? [];
  const totalCount = data?.pages[0]?.total ?? 0;
  const hasInProgressTasks = taskItems.some((item) => isInProgressStatus(item.status));
  const shouldRenderMobileModal = open && isMobileViewport;
  const pluginById: Record<string, TaskPluginSummary> = {};

  const handlePanelScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (!hasNextPage || isFetchingNextPage) {
      return;
    }
    const { scrollTop, clientHeight, scrollHeight } = event.currentTarget;
    if (scrollTop + clientHeight < scrollHeight - 80) {
      return;
    }
    void fetchNextPage();
  };

  const handleRetryTask = async (task: TaskListItem) => {
    if (!projectId || !kbId) {
      dispatch(
        enqueueToast({
          variant: 'error',
          message: '缺少项目或知识库信息，无法重新处理任务。',
        })
      );
      return;
    }
    if (retryingTaskId !== null) {
      return;
    }
    setRetryingTaskId(task.taskId);
    try {
      await taskApi.retryFailedTask({
        taskId: task.taskId,
        projectId,
        kbId,
      });
      dispatch(
        enqueueToast({
          variant: 'success',
          message: '任务已重新提交处理。',
        })
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : '任务重新处理失败，请稍后重试。';
      dispatch(
        enqueueToast({
          variant: 'error',
          message,
        })
      );
    } finally {
      setRetryingTaskId(null);
    }
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex items-center gap-2 rounded-xl bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] text-xs font-black tracking-widest text-slate-500 dark:text-[#e0e0e0] shadow-sm hover:border-primary hover:text-primary transition ${
          compactOnMobile ? 'h-10 px-3 sm:px-4' : 'h-10 px-4'
        }`}
        aria-expanded={open}
      >
        <span className="relative flex h-5 w-5 items-center justify-center">
          <MaterialIcon
            name="history"
            className={`text-[20px] text-slate-900 dark:text-slate-200 ${hasInProgressTasks ? 'opacity-0' : ''}`}
          />
          {hasInProgressTasks && (
            <span className="absolute inset-0 flex items-center justify-center">
              <LoadingSpinner
                size={16}
                label=""
                borderColor="rgba(0,0,0,0.2)"
                borderTopColor="#000"
              />
            </span>
          )}
        </span>
        <div className="flex items-baseline gap-1 text-left">
          <span className={compactOnMobile ? 'hidden text-[11px] font-black uppercase tracking-[0.3em] sm:inline' : 'text-[11px] font-black uppercase tracking-[0.3em]'}>
            任务
          </span>
          <span className="text-[10px] font-black text-slate-400 dark:text-slate-500">({totalCount})</span>
        </div>
        <MaterialIcon
          name="keyboard_arrow_down"
          className={compactOnMobile ? 'text-lg sm:text-lg' : 'text-lg'}
        />
      </button>

      <Modal
        isOpen={shouldRenderMobileModal}
        title="任务列表"
        onClose={() => setOpen(false)}
      >
        <div
          onScroll={handlePanelScroll}
          className="max-h-[min(70vh,32rem)] overflow-y-auto pr-1 md:hidden"
        >
          <TaskListPanelContent
            items={taskItems}
            isLoading={isLoading}
            isError={isError}
            isFetchingNextPage={isFetchingNextPage}
            hasNextPage={Boolean(hasNextPage)}
            docNameMap={docNameMap}
            pluginById={pluginById}
            retryingTaskId={retryingTaskId}
            onRetryTask={handleRetryTask}
          />
        </div>
      </Modal>

      {open && (
        <div
          ref={panelRef}
          onScroll={handlePanelScroll}
          className="absolute right-0 z-10 mt-2 hidden max-h-72 w-[26rem] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-black/10 dark:border-[#2a2a2a] dark:bg-[#1a1a1a] md:block"
        >
          <div className="px-4 py-3 border-b border-slate-100 dark:border-[#2a2a2a]">
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400 dark:text-[#a0a0a0]">任务列表</p>
          </div>
          <div className="px-4 py-3">
            <TaskListPanelContent
              items={taskItems}
              isLoading={isLoading}
              isError={isError}
              isFetchingNextPage={isFetchingNextPage}
              hasNextPage={Boolean(hasNextPage)}
              docNameMap={docNameMap}
              pluginById={pluginById}
              retryingTaskId={retryingTaskId}
              onRetryTask={handleRetryTask}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskListButton;
