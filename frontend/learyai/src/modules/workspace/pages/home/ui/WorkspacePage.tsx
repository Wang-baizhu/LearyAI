// WorkspacePage 负责组合工作区页面、首登概念介绍和分步操作引导。
import React, { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Header } from '../../../widgets';
import { Hero } from '../../../widgets';
import { QuickActions } from '../../../widgets';
import { KnowledgeBaseOverview } from '../../../widgets';
import { GettingStarted } from '../../../widgets';
import { ProjectManagement } from '../../../widgets';
import { ProjectEntryModal } from '../../../widgets';
import { authApi, useCurrentUser, useUserSession } from '../../../../auth';
import GlobalMobileBottomNav from '@/shared/ui/GlobalMobileBottomNav';
import MobileActionSheet from '@/shared/ui/MobileActionSheet';
import { Modal } from '@leary/ui';
import {
  CreateKnowledgeBaseForm,
  useCreateKnowledgeBase,
  type KnowledgeBaseCreatePayload,
} from '../../../../knowledge-base';
import { useCreateProject, type ProjectCreatePayload } from '../../../../project';
import { useRecentVisits, type RecentVisitItem } from '../../../../visit';
import { useAppDispatch } from '@/app/store/hooks';
import { openDialog } from '@/app/store/ui/dialogSlice';
import { resolveApiErrorMessage } from '@/shared/api/resolveApiError';
import InlineNotice from '@/shared/ui/InlineNotice';
import { useWorkspaceProjects } from '../../../adapter';
import { IntroAnimation, type ConceptItem } from '@leary/intro-animation';
import { TourOverlay, TourProvider } from '@leary/tour-guide';
import { safeLocalStorageGet, safeLocalStorageSet } from '@/shared/lib/safeLocalStorage';
import { buildResourceCenterPath, buildResourceRouteState, buildWorkspacePath } from '@/modules/resource';

const WORKSPACE_TOUR_TAG = 'workspace-quick-start-v1';
const WORKSPACE_INTRO_SEEN_KEY_PREFIX = 'workspace:intro:seen';
type WorkspaceTab = 'quick-start' | 'project-management';

const readWorkspaceTab = (search: string): WorkspaceTab => {
  const tab = new URLSearchParams(search).get('tab');
  if (tab === 'project-management') {
    return tab;
  }
  return 'quick-start';
};

const INTRO_ITEMS: ConceptItem[] = [
  {
    term: '概念介绍',
    description: '欢迎使用learyAI，接下来将会介绍一下概念名词，以方便您快速入手。',
  },
  {
    term: '空间',
    description: '空间用于管理协作成员、权限和创建管理不同知识库。',
  },
  {
    term: '知识库',
    description: '知识库是组织资料和可视化模板的核心容器，可按空间进行隔离和管理。',
  },
  {
    term: '参考文档',
    description: '参考文档通过引用的方式加入ai对话，用于回答和引用溯源。',
  },
  {
    term: '可视化模板',
    description: '模板根据参考文档输出为可视化可互动的脑图、题目等内容。',
  }
];

const WorkspacePage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const { setSession } = useUserSession();
  const activeTab = useMemo(() => readWorkspaceTab(location.search), [location.search]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [showMobileCreateSheet, setShowMobileCreateSheet] = useState(false);
  const createMutation = useCreateKnowledgeBase();
  const workspaceProjects = useWorkspaceProjects();
  const recentQuery = useRecentVisits(10);
  const createProjectMutation = useCreateProject();
  const dispatch = useAppDispatch();
  const [dismissedIntroKeys, setDismissedIntroKeys] = useState<string[]>([]);
  const introSeenStorageKey = currentUser?.id
    ? `${WORKSPACE_INTRO_SEEN_KEY_PREFIX}:${currentUser.id}`
    : null;
  const currentPath = `${location.pathname}${location.search}`;
  const resolvedIntroSeenStorageKey = introSeenStorageKey ?? '';
  const showIntro =
    Boolean(introSeenStorageKey) &&
    safeLocalStorageGet(resolvedIntroSeenStorageKey) !== 'true' &&
    !dismissedIntroKeys.includes(resolvedIntroSeenStorageKey);

  const handleIntroComplete = useCallback(() => {
    if (introSeenStorageKey) {
      safeLocalStorageSet(introSeenStorageKey, 'true');
      setDismissedIntroKeys((current) =>
        current.includes(introSeenStorageKey) ? current : [...current, introSeenStorageKey]
      );
    }
  }, [introSeenStorageKey]);

  const handleLogout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error('退出登录失败：', error);
    } finally {
      setSession(null);
      navigate('/');
    }
  }, [navigate, setSession]);

  const handleCreateKnowledgeBase = useCallback(() => {
    createMutation.reset();
    setShowCreateModal(true);
  }, [createMutation]);

  const handleSubmitCreate = useCallback(
    async (payload: KnowledgeBaseCreatePayload) => {
      createMutation.mutate(payload, {
        onSuccess: (data) => {
          setShowCreateModal(false);
          const createdKbId = data.item?.kbId;
          if (createdKbId && workspaceProjects.defaultProjectId) {
            navigate(buildResourceCenterPath(workspaceProjects.defaultProjectId, createdKbId), {
              state: buildResourceRouteState(currentPath),
            });
          }
        },
      });
    },
    [createMutation, currentPath, navigate, workspaceProjects.defaultProjectId]
  );

  const handleVisit = useCallback(
    (item: RecentVisitItem) => {
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
        navigate(`/project/${item.projectId}`, {
          state: buildResourceRouteState(currentPath),
        });
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
    },
    [currentPath, dispatch, navigate]
  );

  const recentProjectNotice = (() => {
    if (workspaceProjects.isError) {
      const message = resolveApiErrorMessage(workspaceProjects.error, '项目加载失败，请稍后重试');
      return { variant: 'error' as const, message };
    }
    return null;
  })();
  const recentContentStatusText = recentQuery.isLoading ? '加载中...' : null;
  const activeNavKey = activeTab === 'project-management' ? 'project' : 'home';
  const handleCreateProject = useCallback(() => {
    createProjectMutation.reset();
    setShowCreateProjectModal(true);
  }, [createProjectMutation]);

  const handlePlaceholderAction = useCallback(() => {
    dispatch(
      openDialog({
        type: 'error',
        payload: {
          title: '功能预留中',
          message: '这里暂时保留为占位入口，后续按需接入新能力。',
        },
      })
    );
  }, [dispatch]);
  const recentVisitItems = useMemo(
    () => recentQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [recentQuery.data?.pages]
  );
  const latestVisitedKnowledgeBase = useMemo(
    () => recentVisitItems.find((item) => item.available && item.resourceType === 'KB' && item.projectId && item.kbId) ?? null,
    [recentVisitItems]
  );
  const latestVisitedProject = useMemo(
    () => recentVisitItems.find((item) => item.available && item.resourceType === 'PROJECT' && item.projectId) ?? null,
    [recentVisitItems]
  );
  const workspaceActionSheetActions = useMemo(
    () => ([
      {
        key: 'new-knowledge-base',
        label: '新建知识库',
        icon: 'book_4',
        onClick: handleCreateKnowledgeBase,
      },
      {
        key: 'create-project',
        label: '新建空间',
        icon: 'create_new_folder',
        onClick: handleCreateProject,
      },
      ...(latestVisitedKnowledgeBase
        ? [{
            key: 'enter-latest-knowledge-base',
            label: `进入${latestVisitedKnowledgeBase.title ?? '最近'}知识库`,
            icon: 'menu_book',
            onClick: () => handleVisit(latestVisitedKnowledgeBase),
          }]
        : []),
      ...(latestVisitedProject
        ? [{
            key: 'enter-latest-project',
            label: `进入${latestVisitedProject.title ?? '最近'}空间`,
            icon: 'dashboard',
            onClick: () => handleVisit(latestVisitedProject),
          }]
        : []),
    ]),
    [handleCreateKnowledgeBase, handleCreateProject, handleVisit, latestVisitedKnowledgeBase, latestVisitedProject]
  );
  const handleWorkspaceTabChange = useCallback(
    (tab: WorkspaceTab) => {
      navigate(buildWorkspacePath(tab));
    },
    [navigate]
  );

  const handleSubmitProject = useCallback(
    (payload: ProjectCreatePayload) => {
      createProjectMutation.mutate(payload, {
        onSuccess: () => {
          setShowCreateProjectModal(false);
        },
      });
    },
    [createProjectMutation]
  );

  return (
    <TourProvider tags={showIntro ? [] : [WORKSPACE_TOUR_TAG]}>
      <div className="min-h-screen bg-slate-50 dark:bg-[#121212] text-slate-900 dark:text-[#e0e0e0]">
        <Header
          onLogout={handleLogout}
          activeTab={activeTab}
          onTabChange={handleWorkspaceTabChange}
          enableTour={!showIntro}
        />

        <main className="mx-auto max-w-7xl space-y-8 px-6 py-6 pb-28 sm:py-8 lg:px-12 lg:space-y-12 lg:pb-10 lg:pt-10">
          {activeTab === 'quick-start' ? (
            <>
              <Hero />

              <div className="mt-6 space-y-8 md:mt-12 md:space-y-12">
                <QuickActions
                  onCreateKnowledgeBase={handleCreateKnowledgeBase}
                  onCreateProject={handleCreateProject}
                  onPlaceholderAction={handlePlaceholderAction}
                />

                {recentProjectNotice ? (
                  <InlineNotice variant={recentProjectNotice.variant} message={recentProjectNotice.message} />
                ) : null}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  <div className="lg:col-span-8">
                    <KnowledgeBaseOverview
                      query={recentQuery}
                      statusText={recentContentStatusText}
                      onVisit={handleVisit}
                    />
                  </div>
                  <div className="lg:col-span-4">
                    <GettingStarted />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <ProjectManagement
              onCreateProject={handleCreateProject}
              projectsState={workspaceProjects}
            />
          )}
        </main>

        <Modal isOpen={showCreateModal} title="新建知识库" onClose={() => setShowCreateModal(false)}>
          <CreateKnowledgeBaseForm
            mutation={createMutation}
            onSubmit={handleSubmitCreate}
            defaultProjectId={workspaceProjects.defaultProjectId}
            projects={workspaceProjects.projects}
            projectsLoading={workspaceProjects.isLoading}
            projectsErrorMessage={
              workspaceProjects.isError
                ? resolveApiErrorMessage(workspaceProjects.error, '项目加载失败，请稍后重试')
                : null
            }
          />
        </Modal>
        <ProjectEntryModal
          isOpen={showCreateProjectModal}
          onClose={() => setShowCreateProjectModal(false)}
          createMutation={createProjectMutation}
          onSubmitProject={handleSubmitProject}
          onInviteAccepted={() => setShowCreateProjectModal(false)}
        />
        {showIntro ? (
          <IntroAnimation items={INTRO_ITEMS} autoPlayDuration={10000} onComplete={handleIntroComplete} />
        ) : null}
        <TourOverlay />
        <MobileActionSheet
          isOpen={showMobileCreateSheet}
          title="快捷创建"
          onClose={() => setShowMobileCreateSheet(false)}
          actions={workspaceActionSheetActions}
        />
        <GlobalMobileBottomNav
          leftItem={{ key: 'home', onClick: () => handleWorkspaceTabChange('quick-start') }}
          rightItem={{ key: 'project', onClick: () => handleWorkspaceTabChange('project-management') }}
          activeKey={activeNavKey}
          centerAction={{
            onClick: () => setShowMobileCreateSheet(true),
            ariaLabel: '打开快捷创建',
          }}
        />
      </div>
    </TourProvider>
  );
};

export default WorkspacePage;
