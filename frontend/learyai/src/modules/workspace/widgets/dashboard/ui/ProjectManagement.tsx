// ProjectManagement 负责展示空间管理列表与搜索入口。
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  RenameProjectForm,
  useDeleteProject,
  useRenameProject,
  type Project,
} from '../../../../project';
import { buildProjectDetailPath, buildResourceRouteState } from '@/modules/resource';
import { type WorkspaceProjectsState } from '../../../adapter';
import MobileClickableCard from '@/shared/ui/MobileClickableCard';
import ResponsiveCardCollection from '@/shared/ui/ResponsiveCardCollection';
import SharedLinkCard from '@/shared/ui/SharedLinkCard';
import { resolveApiErrorMessage } from '@/shared/api/resolveApiError';
import { Modal } from '@leary/ui';
import { ConfirmDialog } from '@leary/ui';
import { useAppDispatch } from '@/app/store/hooks';
import { openDialog } from '@/app/store/ui/dialogSlice';
import { enqueueToast } from '@/app/store/ui/toastSlice';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';
import SkeletonLoader from '@/shared/ui/SkeletonLoader';
import { safeLocalStorageGet, safeLocalStorageSet } from '@/shared/lib/safeLocalStorage';

interface ProjectManagementProps {
  onCreateProject: () => void;
  projectsState: WorkspaceProjectsState;
}

const OWNER_PROJECT_LIST_COUNT_STORAGE_KEY = 'workspace:project:owner:list-count';
const JOINED_PROJECT_LIST_COUNT_STORAGE_KEY = 'workspace:project:joined:list-count';
const readPersistedCount = (key: string): number => {
  const raw = safeLocalStorageGet(key);
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(Math.floor(parsed), 12);
};
const persistCount = (key: string, count: number) => {
  if (!Number.isFinite(count) || count < 0) return;
  safeLocalStorageSet(key, String(Math.floor(count)));
};

const ProjectMobileCard: React.FC<{
  project: Project;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
}> = ({ project, onOpen, onRename, onDelete }) => (
  <MobileClickableCard onClick={onOpen}>
    <div className="flex items-start gap-3">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-500 ring-1 ring-slate-100 dark:bg-[#202020] dark:text-slate-300 dark:ring-[#2a2a2a]">
        <MaterialIcon name="folder" className="text-[22px]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold text-slate-800 dark:text-white" title={project.name}>
              {project.name}
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">暂无描述</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onRename();
              }}
              className="inline-flex size-7 items-center justify-center rounded-lg border border-transparent text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 dark:text-slate-500"
              aria-label="修改空间"
            >
              <MaterialIcon name="edit" className="text-base" />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              className="inline-flex size-7 items-center justify-center rounded-lg border border-transparent text-slate-400 transition-colors hover:border-rose-300 hover:text-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/60 dark:text-slate-500"
              aria-label="删除空间"
            >
              <MaterialIcon name="delete" className="text-base" />
            </button>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-[#2a2a2a]">
          <span className="rounded-lg border border-slate-200 bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:border-[#2a2a2a] dark:bg-[#202020] dark:text-slate-300">
            {project.role ?? '未设置角色'}
          </span>
          <span className="text-[11px] font-semibold text-slate-400">查看详情</span>
        </div>
      </div>
    </div>
  </MobileClickableCard>
);

const ProjectDesktopCard: React.FC<{
  project: Project;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
}> = ({ project, onOpen, onRename, onDelete }) => (
  <SharedLinkCard
    onClick={onOpen}
    title={project.name}
    className="opacity-100"
    headerLeft={(
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-lg font-bold text-slate-500 ring-1 ring-slate-200 dark:bg-[#202020] dark:text-slate-300 dark:ring-[#2a2a2a]">
        <MaterialIcon name="folder" className="text-[22px]" />
      </div>
    )}
    headerActions={(
      <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRename();
          }}
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-primary dark:text-slate-500 dark:hover:bg-[#202020]"
          aria-label="修改空间"
        >
          <MaterialIcon name="edit" className="text-base" />
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500 dark:text-slate-500 dark:hover:bg-rose-900/20"
          aria-label="删除空间"
        >
          <MaterialIcon name="delete" className="text-base" />
        </button>
      </div>
    )}
    footerLeft={(
      <span className="rounded-lg border border-slate-200 bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:border-[#2a2a2a] dark:bg-[#202020] dark:text-slate-300">
        {project.role ?? '未设置角色'}
      </span>
    )}
  >
    <p className="text-sm text-slate-500 dark:text-slate-400">暂无描述</p>
  </SharedLinkCard>
);

const ProjectManagement: React.FC<ProjectManagementProps> = ({ onCreateProject, projectsState }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [renamingProject, setRenamingProject] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const projects = useMemo(() => projectsState.projects, [projectsState.projects]);
  const renameMutation = useRenameProject();
  const deleteMutation = useDeleteProject();
  const dispatch = useAppDispatch();
  const currentPath = `${location.pathname}${location.search}`;

  const filteredProjects = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) {
      return projects;
    }
    return projects.filter((project) => project.name.toLowerCase().includes(keyword));
  }, [projects, searchTerm]);

  const ownerProjects = useMemo(
    () => filteredProjects.filter((project) => project.role === 'OWNER'),
    [filteredProjects]
  );
  const joinedProjects = useMemo(
    () => filteredProjects.filter((project) => project.role !== 'OWNER'),
    [filteredProjects]
  );
  const ownerProjectCount = useMemo(
    () => projects.filter((project) => project.role === 'OWNER').length,
    [projects]
  );
  const joinedProjectCount = useMemo(
    () => projects.filter((project) => project.role !== 'OWNER').length,
    [projects]
  );

  const errorMessage = projectsState.isError
    ? resolveApiErrorMessage(projectsState.error, '空间加载失败，请稍后重试')
    : null;
  const ownerProjectSkeletonCount = Math.max(1, readPersistedCount(OWNER_PROJECT_LIST_COUNT_STORAGE_KEY));
  const joinedProjectSkeletonCount = readPersistedCount(JOINED_PROJECT_LIST_COUNT_STORAGE_KEY);

  useEffect(() => {
    if (projectsState.isLoading || projectsState.isError) return;
    persistCount(OWNER_PROJECT_LIST_COUNT_STORAGE_KEY, ownerProjectCount);
    persistCount(JOINED_PROJECT_LIST_COUNT_STORAGE_KEY, joinedProjectCount);
  }, [joinedProjectCount, ownerProjectCount, projectsState.isError, projectsState.isLoading]);

  return (
    <section className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-3">空间管理</h2>
          <p className="text-lg text-slate-500 dark:text-slate-400">查看并进入您的项目空间</p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative group flex-grow md:flex-grow-0">
            <MaterialIcon
              name="search"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors text-xl"
            />
            <input
              type="text"
              placeholder="搜索您的空间..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full md:w-72 pl-12 pr-4 py-3 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] rounded-2xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none text-sm font-medium placeholder:text-slate-400 transition-all"
            />
          </div>
          <button
            type="button"
            onClick={onCreateProject}
            className="flex items-center gap-2 px-5 py-3 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all whitespace-nowrap"
          >
            <MaterialIcon name="add" className="text-xl" />
            <span>创建空间</span>
          </button>
        </div>
      </div>

      {projectsState.isLoading ? (
        <div className="space-y-10">
          <div className="space-y-5">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">我的空间</h3>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: ownerProjectSkeletonCount }).map((_, index) => (
                <div
                  key={`owner-project-card-skeleton-${index}`}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#2a2a2a] dark:bg-[#1a1a1a]"
                >
                  <div className="mb-4 flex items-start justify-between">
                    <div className="size-12 rounded-xl bg-slate-100 dark:bg-[#202020]" />
                    <div className="flex gap-2">
                      <div className="size-8 rounded-lg bg-slate-200/70 dark:bg-slate-700/50 animate-pulse" />
                      <div className="size-8 rounded-lg bg-slate-200/70 dark:bg-slate-700/50 animate-pulse" />
                    </div>
                  </div>
                  <SkeletonLoader
                    barCount={2}
                    maxWidths={['72%', '46%']}
                    delayBase={90}
                    className="mb-4"
                  />
                  <SkeletonLoader
                    barCount={1}
                    maxWidths={['58%']}
                    delayBase={90}
                    className="mb-6"
                  />
                  <div className="border-t border-slate-100 pt-4 dark:border-[#2a2a2a]">
                    <SkeletonLoader
                      barCount={1}
                      maxWidths={['32%']}
                      delayBase={90}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {joinedProjectSkeletonCount > 0 ? (
            <div className="space-y-5">
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">加入的其他空间</h3>
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: joinedProjectSkeletonCount }).map((_, index) => (
                  <div
                    key={`joined-project-card-skeleton-${index}`}
                    className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#2a2a2a] dark:bg-[#1a1a1a]"
                  >
                    <div className="mb-4 flex items-start justify-between">
                      <div className="size-12 rounded-xl bg-slate-100 dark:bg-[#202020]" />
                      <div className="flex gap-2">
                        <div className="size-8 rounded-lg bg-slate-200/70 dark:bg-slate-700/50 animate-pulse" />
                        <div className="size-8 rounded-lg bg-slate-200/70 dark:bg-slate-700/50 animate-pulse" />
                      </div>
                    </div>
                    <SkeletonLoader
                      barCount={2}
                      maxWidths={['72%', '46%']}
                      delayBase={90}
                      className="mb-4"
                    />
                    <SkeletonLoader
                      barCount={1}
                      maxWidths={['58%']}
                      delayBase={90}
                      className="mb-6"
                    />
                    <div className="border-t border-slate-100 pt-4 dark:border-[#2a2a2a]">
                      <SkeletonLoader
                        barCount={1}
                        maxWidths={['32%']}
                        delayBase={90}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : errorMessage ? (
        <div className="py-16 text-center text-slate-400 dark:text-[#a0a0a0]">{errorMessage}</div>
      ) : filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-slate-100 dark:bg-[#1a1a1a] rounded-3xl flex items-center justify-center text-slate-300 mb-6 ring-1 ring-slate-200 dark:ring-[#2a2a2a]">
            <MaterialIcon name="manage_search" className="text-4xl" />
          </div>
          <h3 className="text-2xl font-black text-slate-700 dark:text-slate-200">未找到匹配空间</h3>
          <p className="text-slate-500 dark:text-[#a0a0a0] mt-2 font-medium">尝试使用其他关键词重新搜索</p>
        </div>
      ) : (
        <div className="space-y-10">
          {ownerProjects.length > 0 ? (
            <div className="space-y-5">
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">我的空间</h3>
              <ResponsiveCardCollection
                items={ownerProjects}
                getKey={(project) => project.projectId}
                desktopGridClassName="hidden grid-cols-1 gap-8 md:grid md:grid-cols-2 lg:grid-cols-3"
                renderMobileItem={(project) => (
                  <ProjectMobileCard
                    project={project}
                    onOpen={() => navigate(buildProjectDetailPath(project.projectId), {
                      state: buildResourceRouteState(currentPath),
                    })}
                    onRename={() => {
                      renameMutation.reset();
                      setRenamingProject(project);
                    }}
                    onDelete={() => setDeleteTarget(project)}
                  />
                )}
                renderDesktopItem={(project) => (
                  <ProjectDesktopCard
                    project={project}
                    onOpen={() => navigate(buildProjectDetailPath(project.projectId), {
                      state: buildResourceRouteState(currentPath),
                    })}
                    onRename={() => {
                      renameMutation.reset();
                      setRenamingProject(project);
                    }}
                    onDelete={() => setDeleteTarget(project)}
                  />
                )}
              />
            </div>
          ) : null}

          {joinedProjects.length > 0 ? (
            <div className="space-y-5">
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">加入的其他空间</h3>
              <ResponsiveCardCollection
                items={joinedProjects}
                getKey={(project) => project.projectId}
                desktopGridClassName="hidden grid-cols-1 gap-8 md:grid md:grid-cols-2 lg:grid-cols-3"
                renderMobileItem={(project) => (
                  <ProjectMobileCard
                    project={project}
                    onOpen={() => navigate(buildProjectDetailPath(project.projectId), {
                      state: buildResourceRouteState(currentPath),
                    })}
                    onRename={() => {
                      renameMutation.reset();
                      setRenamingProject(project);
                    }}
                    onDelete={() => setDeleteTarget(project)}
                  />
                )}
                renderDesktopItem={(project) => (
                  <ProjectDesktopCard
                    project={project}
                    onOpen={() => navigate(buildProjectDetailPath(project.projectId), {
                      state: buildResourceRouteState(currentPath),
                    })}
                    onRename={() => {
                      renameMutation.reset();
                      setRenamingProject(project);
                    }}
                    onDelete={() => setDeleteTarget(project)}
                  />
                )}
              />
            </div>
          ) : null}
        </div>
      )}

      <Modal isOpen={Boolean(renamingProject)} title="重命名空间" onClose={() => setRenamingProject(null)}>
        {renamingProject ? (
          <RenameProjectForm
            key={renamingProject.projectId}
            defaultName={renamingProject.name}
            isSubmitting={renameMutation.isPending}
            onSubmit={(payload) => {
              renameMutation.mutate(
                {
                  projectId: renamingProject.projectId,
                  payload,
                },
                {
                  onSuccess: () => {
                    setRenamingProject(null);
                    dispatch(
                      enqueueToast({
                        variant: 'success',
                        message: '重命名成功',
                      })
                    );
                  },
                  onError: (error) => {
                    const message = resolveApiErrorMessage(error, '重命名失败，请稍后再试');
                    dispatch(
                      openDialog({
                        type: 'error',
                        payload: {
                          title: '出错了',
                          message,
                        },
                      })
                    );
                  },
                }
              );
            }}
          />
        ) : null}
      </Modal>
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="删除空间"
        message={
          deleteTarget ? `确认删除「${deleteTarget.name}」？此操作无法撤销。` : '确认删除该空间？'
        }
        confirmText="删除"
        onConfirm={() => {
          if (!deleteTarget || deleteMutation.isPending) {
            return;
          }
          deleteMutation.mutate(
            { projectId: deleteTarget.projectId },
            {
              onSuccess: () => {
                setDeleteTarget(null);
                dispatch(
                  enqueueToast({
                    variant: 'success',
                    message: '删除成功',
                  })
                );
              },
              onError: (error) => {
                const message = resolveApiErrorMessage(error, '删除失败，请稍后再试');
                dispatch(
                  openDialog({
                    type: 'error',
                    payload: {
                      title: '出错了',
                      message,
                    },
                  })
                );
              },
            }
          );
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </section>
  );
};

export default ProjectManagement;
