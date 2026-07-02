// ProjectDetailPage 负责渲染项目详情的模拟页面与内容概览。
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import ThemeToggle from '@/shared/ui/ThemeToggle';
import UserMenu from '@/shared/ui/UserMenu';
import AddIconButton from '@/shared/ui/AddIconButton';
import MobileClickableCard from '@/shared/ui/MobileClickableCard';
import ResponsiveCardCollection from '@/shared/ui/ResponsiveCardCollection';
import SharedLinkCard from '@/shared/ui/SharedLinkCard';
import MobileActionSheet from '@/shared/ui/MobileActionSheet';
import { authApi, useCurrentUser, useUserSession } from '../../../../auth';
import { ProjectEntryModal } from '@/modules/workspace';
import ProjectDetailSidebar from '../../../widgets/project-detail';
import {
  CreateKnowledgeBaseForm,
  EditKnowledgeBaseForm,
  type KnowledgeBase,
} from '../../../../knowledge-base';
import { useProjectKnowledgeBaseManagement } from '../../../adapter';
import { formatVisitedAt } from '@/shared/lib/formatters';
import GlobalMobileBottomNav from '@/shared/ui/GlobalMobileBottomNav';
import { Modal } from '@leary/ui';
import { useProjects } from '../../../features/list';
import { useCreateProject } from '@/modules/project';
import { useRecentVisits, type RecentVisitItem } from '../../../../visit';
import { resolveApiErrorMessage } from '@/shared/api/resolveApiError';
import { ConfirmDialog } from '@leary/ui';
import { useAppDispatch } from '@/app/store/hooks';
import { openDialog } from '@/app/store/ui/dialogSlice';
import { enqueueToast } from '@/app/store/ui/toastSlice';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';
import { useTheme } from '@/shared/contexts/useTheme';
import SkeletonLoader from '@/shared/ui/SkeletonLoader';
import { safeLocalStorageGet, safeLocalStorageSet } from '@/shared/lib/safeLocalStorage';
import { TourOverlay, TourProvider, TourStep } from '@leary/tour-guide';
import {
  buildResourceCenterPath,
  buildResourceRouteState,
  buildWorkspacePath,
  resolveProjectDetailBackTarget,
} from '@/modules/resource';

const knowledgeBaseIconConfig = [
  { icon: 'book_4', iconBg: 'bg-emerald-50 dark:bg-emerald-900/30', iconColor: 'text-emerald-500' },
  { icon: 'book_4', iconBg: 'bg-sky-50 dark:bg-sky-900/30', iconColor: 'text-sky-500' },
  { icon: 'book_4', iconBg: 'bg-amber-50 dark:bg-amber-900/30', iconColor: 'text-amber-500' },
  { icon: 'book_4', iconBg: 'bg-rose-50 dark:bg-rose-900/30', iconColor: 'text-rose-500' },
  { icon: 'book_4', iconBg: 'bg-violet-50 dark:bg-violet-900/30', iconColor: 'text-violet-500' },
];
const visibilityLabelMap = {
  PRIVATE: '私有',
  TEAM: '团队',
  PUBLIC: '公开',
} as const;
const PROJECT_DETAIL_KB_COUNT_STORAGE_PREFIX = 'project-detail:kb:list-count';
const PROJECT_DETAIL_GUIDE_TAG = 'guide:project-detail:v1';
const readPersistedKbCount = (key: string): number => {
  const raw = safeLocalStorageGet(key);
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(Math.floor(parsed), 12);
};
const persistKbCount = (key: string, count: number) => {
  if (!Number.isFinite(count) || count <= 0) return;
  safeLocalStorageSet(key, String(Math.floor(count)));
};

const ProjectKnowledgeBaseMobileCard: React.FC<{
  knowledgeBase: KnowledgeBase;
  iconConfig: typeof knowledgeBaseIconConfig[number];
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ knowledgeBase, iconConfig, onOpen, onEdit, onDelete }) => (
  <MobileClickableCard onClick={onOpen}>
    <div className="flex items-start gap-3">
      <div className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${iconConfig.iconBg} ${iconConfig.iconColor} shadow-inner`}>
        <MaterialIcon name={iconConfig.icon} className="text-2xl" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold text-slate-800 dark:text-white" title={knowledgeBase.name}>
              {knowledgeBase.name}
            </h3>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {knowledgeBase.description ?? '暂无描述'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="inline-flex size-7 items-center justify-center rounded-lg border border-transparent text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              aria-label="编辑内容"
              onClick={(event) => {
                event.stopPropagation();
                onEdit();
              }}
            >
              <MaterialIcon name="edit" className="text-base" />
            </button>
            <button
              type="button"
              className="inline-flex size-7 items-center justify-center rounded-lg border border-transparent text-slate-400 transition-colors hover:border-rose-300 hover:text-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/60"
              aria-label="删除内容"
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
            >
              <MaterialIcon name="delete" className="text-base" />
            </button>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-[#2a2a2a]">
          <div className="flex min-w-0 items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <MaterialIcon name="schedule" className="text-sm" />
            <span className="truncate text-[10px] font-medium italic text-slate-400">
              访问于 {formatVisitedAt(knowledgeBase.visitedAt)}
            </span>
            <span className="shrink-0 text-[10px] font-medium text-slate-400">
              · {visibilityLabelMap[knowledgeBase.visibility] ?? '私有'}
            </span>
          </div>
          <span className="shrink-0 text-[11px] font-semibold text-slate-400">查看详情</span>
        </div>
      </div>
    </div>
  </MobileClickableCard>
);

const ProjectKnowledgeBaseDesktopCard: React.FC<{
  knowledgeBase: KnowledgeBase;
  iconConfig: typeof knowledgeBaseIconConfig[number];
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ knowledgeBase, iconConfig, onOpen, onEdit, onDelete }) => (
  <SharedLinkCard
    title={knowledgeBase.name}
    onClick={onOpen}
    headerLeft={(
      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${iconConfig.iconBg} ${iconConfig.iconColor} shadow-inner`}>
        <MaterialIcon name={iconConfig.icon} className="text-2xl" />
      </div>
    )}
    headerActions={(
      <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <button
          type="button"
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-primary dark:hover:bg-[#202020]"
          aria-label="编辑内容"
          onClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
        >
          <MaterialIcon name="edit" className="text-base" />
        </button>
        <button
          type="button"
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-900/20"
          aria-label="删除内容"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
        >
          <MaterialIcon name="delete" className="text-base" />
        </button>
      </div>
    )}
    footerLeft={(
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        <MaterialIcon name="schedule" className="text-sm" />
        <span className="text-[10px] font-medium italic text-slate-400">
          访问于 {formatVisitedAt(knowledgeBase.visitedAt)}
        </span>
        <span className="text-[10px] font-medium text-slate-400">
          · {visibilityLabelMap[knowledgeBase.visibility] ?? '私有'}
        </span>
      </div>
    )}
  >
    <p className="line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
      {knowledgeBase.description ?? '暂无描述'}
    </p>
  </SharedLinkCard>
);

const ProjectDetailPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { projectId: projectIdParam } = useParams<{ projectId: string }>();
  const projectId = projectIdParam ?? '';
  const { setSession } = useUserSession();
  const user = useCurrentUser();
  const { isDarkMode, toggleTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [showMobileCreateSheet, setShowMobileCreateSheet] = useState(false);
  const [editingKnowledgeBase, setEditingKnowledgeBase] = useState<KnowledgeBase | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeBase | null>(null);
  const size = 6;
  const {
    listQuery,
    createMutation,
    updateMutation,
    deleteMutation,
    knowledgeBases,
    total,
    totalPages,
    listErrorMessage,
  } = useProjectKnowledgeBaseManagement({
    projectId,
    search: searchQuery,
    page,
    size,
  });
  const createProjectMutation = useCreateProject();
  const recentQuery = useRecentVisits(10);
  const projectsQuery = useProjects(1, 20, Boolean(projectId));
  const projectName = projectsQuery.data?.find((project) => project.projectId === projectId)?.name;
  const dispatch = useAppDispatch();
  const projectKbCountStorageKey = `${PROJECT_DETAIL_KB_COUNT_STORAGE_PREFIX}:${projectId || 'unknown'}`;
  const projectKbSkeletonCount = readPersistedKbCount(projectKbCountStorageKey);
  const currentPath = `${location.pathname}${location.search}`;
  const projectsErrorMessage = projectsQuery.isError
    ? resolveApiErrorMessage(projectsQuery.error, '项目加载失败，请稍后重试')
    : null;
  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error('退出登录失败：', error);
    } finally {
      setSession(null);
      navigate('/');
    }
  };

  const handleAddKB = () => {
    createMutation.reset();
    setShowCreateModal(true);
  };

  const handleVisitRecentItem = (item: RecentVisitItem) => {
    if (!item.available) {
      dispatch(
        openDialog({
          type: 'error',
          payload: {
            title: '出错了',
            message: '该内容已不可访问或已删除',
          },
        })
      );
      return;
    }
    if (item.resourceType === 'PROJECT' && item.projectId) {
      navigate(`/project/${item.projectId}`);
      return;
    }
    if (item.resourceType === 'KB' && item.projectId && item.kbId) {
      navigate(buildResourceCenterPath(item.projectId, item.kbId), {
        state: buildResourceRouteState(currentPath),
      });
      return;
    }
    dispatch(
      openDialog({
        type: 'error',
        payload: {
          title: '出错了',
          message: '内容标识不完整，请刷新后重试',
        },
      })
    );
  };

  const handleVisit = (item: KnowledgeBase) => {
    if (!projectId) {
      return;
    }
    navigate(buildResourceCenterPath(projectId, item.kbId), {
      state: buildResourceRouteState(currentPath),
    });
  };

  const visiblePage = Math.min(page, totalPages);

  useEffect(() => {
    if (!projectId || !listQuery.isSuccess) return;
    if (knowledgeBases.length <= 0) return;
    persistKbCount(projectKbCountStorageKey, knowledgeBases.length);
  }, [knowledgeBases.length, listQuery.isSuccess, projectId, projectKbCountStorageKey]);

  const recentVisitItems = recentQuery.data?.pages.flatMap((visitPage) => visitPage.items) ?? [];
  const latestVisitedKnowledgeBase = recentVisitItems.find(
    (item) => item.available && item.resourceType === 'KB' && item.projectId && item.kbId
  ) ?? null;
  const latestVisitedProject = recentVisitItems.find(
    (item) => item.available && item.resourceType === 'PROJECT' && item.projectId
  ) ?? null;
  const mobileCreateActions = [
    {
      key: 'new-knowledge-base',
      label: '新建知识库',
      icon: 'book_4',
      onClick: handleAddKB,
    },
    {
      key: 'create-project',
      label: '新建空间',
      icon: 'create_new_folder',
      onClick: () => {
        createProjectMutation.reset();
        setShowCreateProjectModal(true);
      },
    },
    ...(latestVisitedKnowledgeBase
      ? [{
          key: 'enter-latest-knowledge-base',
          label: `进入${latestVisitedKnowledgeBase.title ?? '最近'}知识库`,
          icon: 'menu_book',
          onClick: () => handleVisitRecentItem(latestVisitedKnowledgeBase),
        }]
      : []),
    ...(latestVisitedProject
      ? [{
          key: 'enter-latest-project',
          label: `进入${latestVisitedProject.title ?? '最近'}空间`,
          icon: 'dashboard',
          onClick: () => handleVisitRecentItem(latestVisitedProject),
        }]
      : []),
  ];

  return (
    <TourProvider tags={[PROJECT_DETAIL_GUIDE_TAG]}>
      <div className="min-h-screen bg-white dark:bg-[#121212] text-slate-900 dark:text-[#e0e0e0] flex flex-col">
        <header className="h-16 px-6 sm:px-10 border-b border-slate-100 dark:border-[#2a2a2a] bg-white/80 dark:bg-[#121212]/80 backdrop-blur-md flex items-center relative z-50">
          <div className="flex items-center justify-between w-full max-w-[1400px] mx-auto">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => navigate(resolveProjectDetailBackTarget(location.state))}
                className="w-9 h-9 rounded-xl border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1b1f21] flex items-center justify-center text-slate-500 hover:text-primary hover:border-primary transition-all"
                aria-label="返回工作区"
              >
                <MaterialIcon name="arrow_back" className="text-[20px]" />
              </button>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {projectName ?? '项目详情'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <ThemeToggle onToggle={toggleTheme} isDarkMode={isDarkMode} />
              <div className="w-px h-6 bg-slate-200 dark:bg-[#2a2a2a]"></div>
              <UserMenu user={user} onLogout={handleLogout} />
            </div>
          </div>
        </header>

      <main className="flex-1 w-full max-w-[1400px] mx-auto px-6 py-10 pb-28 sm:px-10 lg:pb-10">
        <div className="grid grid-cols-12 gap-6 lg:gap-10">
          <section className="order-1 col-span-12 space-y-8 lg:col-span-8">
            <div className="flex flex-col gap-6 pb-2 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <h2 className="flex flex-wrap items-center gap-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                    <span className="lg:hidden">空间</span>
                    <span className="hidden lg:inline">空间总览</span>
                    <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-lg font-bold">
                      {total} Total
                    </span>
                  </h2>
                  <p className="hidden text-sm text-slate-500 dark:text-slate-400 lg:block">
                    查看本项目的所有知识库
                  </p>
                </div>
                <div className="shrink-0 lg:hidden">
                  <ProjectDetailSidebar
                    projectId={projectId}
                    mobileSummaryMode="inline"
                    desktopPanelVisible={false}
                  />
                </div>
              </div>

              <div className="relative group flex-1 lg:flex-initial">
                <MaterialIcon
                  name="search"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px] group-focus-within:text-primary transition-colors"
                />
                <input
                  className="pl-10 pr-4 py-2.5 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] rounded-xl text-sm w-full lg:w-72 focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm outline-none transition-all"
                  placeholder="搜索文档或记录..."
                  type="text"
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </div>

            <div>
              {!projectId ? (
                <div className="py-12 text-center text-slate-400 dark:text-slate-500">
                  缺少项目参数，请从项目入口访问。
                </div>
              ) : listQuery.isLoading ? (
                projectKbSkeletonCount > 0 ? (
                  Array.from({ length: projectKbSkeletonCount }).map((_, index) => {
                    const iconConfig = knowledgeBaseIconConfig[index % knowledgeBaseIconConfig.length];
                    return (
                      <div
                        key={`project-detail-kb-skeleton-${index}`}
                        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#2a2a2a] dark:bg-[#1a1a1a]"
                      >
                        <div className="mb-4 flex items-start justify-between">
                          <div
                            className={`h-12 w-12 rounded-2xl ${iconConfig.iconBg}`}
                          />
                          <div className="h-8 w-8 rounded-lg bg-slate-200/70 animate-pulse dark:bg-slate-700/50" />
                        </div>
                        <SkeletonLoader
                          barCount={3}
                          maxWidths={['76%', '58%', '42%']}
                          className="mb-4"
                        />
                        <div className="border-t border-slate-100 pt-4 dark:border-[#2a2a2a]">
                          <SkeletonLoader
                            barCount={1}
                            maxWidths={['54%']}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-full py-12 text-center text-slate-400 dark:text-slate-500">
                    知识库加载中...
                  </div>
                )
              ) : listQuery.isError ? (
                <div className="col-span-full py-12 text-center text-rose-500">
                  {listErrorMessage}
                </div>
              ) : knowledgeBases.length === 0 ? (
                <div className="py-12 text-center text-slate-400 dark:text-slate-500">
                  暂无知识库，点击右下角创建内容吧。
                </div>
              ) : (
                <ResponsiveCardCollection
                  items={knowledgeBases}
                  getKey={(kb) => kb.kbId}
                  desktopGridClassName="hidden grid-cols-1 gap-6 md:grid md:grid-cols-2"
                  renderMobileItem={(kb, index) => {
                    const iconConfig = knowledgeBaseIconConfig[index % knowledgeBaseIconConfig.length];
                    return (
                      <ProjectKnowledgeBaseMobileCard
                        knowledgeBase={kb}
                        iconConfig={iconConfig}
                        onOpen={() => handleVisit(kb)}
                        onEdit={() => {
                          updateMutation.reset();
                          setEditingKnowledgeBase(kb);
                        }}
                        onDelete={() => setDeleteTarget(kb)}
                      />
                    );
                  }}
                  renderDesktopItem={(kb, index) => {
                    const iconConfig = knowledgeBaseIconConfig[index % knowledgeBaseIconConfig.length];
                    return (
                      <ProjectKnowledgeBaseDesktopCard
                        knowledgeBase={kb}
                        iconConfig={iconConfig}
                        onOpen={() => handleVisit(kb)}
                        onEdit={() => {
                          updateMutation.reset();
                          setEditingKnowledgeBase(kb);
                        }}
                        onDelete={() => setDeleteTarget(kb)}
                      />
                    );
                  }}
                />
              )}
            </div>

            {projectId ? (
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2">
                <span>
                  第 {visiblePage} / {totalPages} 页 · 共 {total} 条
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.max(1, Math.min(prev, totalPages) - 1))}
                    disabled={visiblePage <= 1 || listQuery.isFetching}
                    className="px-3 py-1 rounded-lg border border-slate-200 dark:border-[#2a2a2a] disabled:opacity-50 disabled:cursor-not-allowed hover:border-primary hover:text-primary transition-colors"
                  >
                    上一页
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.min(totalPages, Math.min(prev, totalPages) + 1))}
                    disabled={visiblePage >= totalPages || listQuery.isFetching}
                    className="px-3 py-1 rounded-lg border border-slate-200 dark:border-[#2a2a2a] disabled:opacity-50 disabled:cursor-not-allowed hover:border-primary hover:text-primary transition-colors"
                  >
                    下一页
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          <div className="order-2 col-span-12 lg:col-span-4">
            <ProjectDetailSidebar
              projectId={projectId}
              guideTag={PROJECT_DETAIL_GUIDE_TAG}
              mobileSummaryMode="hidden"
            />
          </div>

        </div>
      </main>

        <TourStep
          tag={PROJECT_DETAIL_GUIDE_TAG}
          order={2}
          title="新建知识库"
          content="这里可以新建知识库。"
        >
          <div className="fixed bottom-10 right-10 z-50 hidden items-center gap-3 lg:flex">
            <AddIconButton label="创建内容" onClick={handleAddKB} />
          </div>
        </TourStep>

      <Modal isOpen={showCreateModal} title="创建知识库" onClose={() => setShowCreateModal(false)}>
        <CreateKnowledgeBaseForm
          mutation={createMutation}
          onSubmit={(payload) =>
            createMutation.mutate(payload, {
              onSuccess: () => {
                setShowCreateModal(false);
              },
            })
          }
          defaultProjectId={projectId || undefined}
          projects={projectsQuery.data ?? []}
          projectsLoading={projectsQuery.isLoading}
          projectsErrorMessage={projectsErrorMessage}
        />
      </Modal>
      <ProjectEntryModal
        isOpen={showCreateProjectModal}
        onClose={() => setShowCreateProjectModal(false)}
        createMutation={createProjectMutation}
        onSubmitProject={(payload) =>
          createProjectMutation.mutate(payload, {
            onSuccess: () => {
              setShowCreateProjectModal(false);
            },
          })
        }
        onInviteAccepted={() => setShowCreateProjectModal(false)}
      />
      <Modal
        isOpen={Boolean(editingKnowledgeBase)}
        title="编辑知识库"
        onClose={() => setEditingKnowledgeBase(null)}
      >
        {editingKnowledgeBase ? (
          <EditKnowledgeBaseForm
            knowledgeBase={editingKnowledgeBase}
            projectId={projectId}
            mutation={updateMutation}
            onSubmit={(payload) => {
              if (!projectId) {
                dispatch(
                  openDialog({
                    type: 'error',
                    payload: {
                      title: '出错了',
                      message: '缺少项目，请刷新后重试',
                    },
                  })
                );
                return;
              }
              updateMutation.mutate(
                {
                  kbId: editingKnowledgeBase.kbId,
                  projectId,
                  payload: {
                    name: payload.name,
                    description: payload.description ?? null,
                    tags: payload.tags ?? [],
                    visibility: payload.visibility,
                  },
                },
                {
                  onSuccess: () => {
                    setEditingKnowledgeBase(null);
                  },
                }
              );
            }}
          />
        ) : null}
      </Modal>
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="删除知识库"
        message={
          deleteTarget ? `确认删除「${deleteTarget.name}」？此操作无法撤销。` : '确认删除该知识库？'
        }
        confirmText="删除"
        onConfirm={() => {
          if (!deleteTarget || deleteMutation.isPending) {
            return;
          }
          if (!projectId) {
            dispatch(
              openDialog({
                type: 'error',
                payload: {
                  title: '出错了',
                  message: '缺少项目，请刷新后重试',
                },
              })
            );
            return;
          }
          deleteMutation.mutate(
            { kbId: deleteTarget.kbId, projectId },
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
        <TourOverlay />
        <MobileActionSheet
          isOpen={showMobileCreateSheet}
          title="快捷创建"
          onClose={() => setShowMobileCreateSheet(false)}
          actions={mobileCreateActions}
        />
        <GlobalMobileBottomNav
          leftItem={{ key: 'home', onClick: () => navigate(buildWorkspacePath('quick-start')) }}
          rightItem={{ key: 'project', onClick: () => navigate(buildWorkspacePath('project-management')) }}
          activeKey="project"
          centerAction={{
            onClick: () => setShowMobileCreateSheet(true),
            ariaLabel: '打开快捷创建',
          }}
        />
      </div>
    </TourProvider>
  );
};

export default ProjectDetailPage;
