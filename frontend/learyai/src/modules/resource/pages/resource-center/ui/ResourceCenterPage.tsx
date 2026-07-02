// ResourceCenterPage 负责展示资源中心列表页面。
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { DEFAULT_FLOW_CANVAS_BOARD } from '@/modules/flow-canvas';
import {
  clearDocNames,
  openResourceCenterDetail,
  openResourceCenterResourceDetail,
  openResourceCenterVideoDetail,
  setSearch,
  useResourceScope,
  upsertDocNames,
} from '../../../entities/resource-center';
import ResourceActionMenu from '../../../features/resource-action-menu';
import { ResourceShareTokenModal } from '../../../features/resource-share-token';
import { ResourceGenerateTaskModal, TaskListButton } from '../../../../task';
import { ResourceImportModal, ResourceImportTextModal, ResourceImportUrlModal, useKbdocOptions } from '../../../../kbdoc';
import ThemeToggle from '@/shared/ui/ThemeToggle';
import UserMenu from '@/shared/ui/UserMenu';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';
import { Modal } from '@leary/ui';
import { authApi, useCurrentUser, useUserSession } from '../../../../auth';
import type { ResourceListItem } from '../../../../kbdoc';
import type { ResourceCenterOutletContext } from './ResourceCenterLayout';
import { useTheme } from '@/shared/contexts/useTheme';
import { ResourceTopTabs } from '../../../widgets/resource-top-tabs';
import { TourStep } from '@leary/tour-guide';
import { isResourceCenterTab } from '../../../entities/resource-center';
import { ResourceCenterContent } from '../../../widgets/resource-center-main';
import {
  buildResourceDetailFullscreenPath,
  buildResourceRouteState,
  resolveResourceCenterBackTarget,
} from '../../../route';

const RESOURCE_CENTER_GUIDE_TAG = 'guide:resource-center:v1';
const GLOBAL_WHITEBOARD_LABEL = '全局视图';

const ResourceCenterPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId, kbId } = useResourceScope();
  const dispatch = useAppDispatch();
  const { setSession } = useUserSession();
  const { isDarkMode, toggleTheme } = useTheme();
  const user = useCurrentUser();
  const { search } = useAppSelector((state) => state.resourceCenter);
  const {
    activeTab,
    activePanel,
    activeTopPanel,
    topTabItems,
    detailTabGroups,
    onSelectTopTab,
    activeDetailTab,
    lastDetailTab,
    detailTabs,
    onOpenDetailTab,
    onCloseDetailTab,
    onCloseSingleDetailTab,
    detailMergeDropZonePrefix,
    onClearDetailJump,
    listState,
    onToggleListReference,
    onPageChange,
    referencedDocIds,
    sidebarResources,
    sidebarReferencedResources,
    referencedDocRefs,
    fallbackDocRef,
    onToggleSidebarReference,
    onClearReferences,
    kbdocListLoading,
    onResourceDeleted,
    disableTemplatePointerEvents,
    isMobileActionSheetOpen,
    closeMobileActionSheet,
  } = useOutletContext<ResourceCenterOutletContext>();
  const [generateType, setGenerateType] = useState<string | 'kbview' | null>(null);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isTopTabsCollapsed, setIsTopTabsCollapsed] = useState(false);
  const docOptionsQuery = useKbdocOptions({ projectId, kbId });
  const currentPath = `${location.pathname}${location.search}`;

  useEffect(() => {
    dispatch(clearDocNames({ projectId, kbId }));
  }, [dispatch, projectId, kbId]);

  useEffect(() => {
    const items = docOptionsQuery.data ?? [];
    if (items.length === 0) return;
    dispatch(
      upsertDocNames({
        context: { projectId, kbId },
        items,
      })
    );
  }, [dispatch, docOptionsQuery.data, kbId, projectId]);

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

  const handleResourceOpen = (docId: string) => {
    if (!kbId || !projectId) return;
    const searchItems =
      listState.kind === 'mixed'
        ? (listState.sections?.find((section) => section.panel === 'kbdoc')?.items as ResourceListItem[] | undefined) ?? []
        : listState.gridItems;
    const target = searchItems.find((item) => item.docId === docId);
    if (!target || target.status !== 'DONE') return;
    openResourceCenterResourceDetail(onOpenDetailTab, {
      docId,
      label: target.name,
    });
  };

  const handleOpenGlobalWhiteboard = useCallback(() => {
    openResourceCenterDetail(onOpenDetailTab, {
      docId: DEFAULT_FLOW_CANVAS_BOARD.boardId,
      label: GLOBAL_WHITEBOARD_LABEL,
      kind: 'whiteboard',
    });
  }, [onOpenDetailTab]);

  const panelMetaByTab = useMemo(
    () => ({
      all: { label: '全部资源', icon: 'folder' },
      kbdoc: { label: '参考文档', icon: 'book_2' },
    }),
    []
  );

  const detailState = useMemo(() => {
    const effectiveDetailTab = activeDetailTab ?? lastDetailTab;
    if (!effectiveDetailTab) return undefined;
    return {
      docId: effectiveDetailTab.docId,
      detailTabKey: effectiveDetailTab.key,
      kbId,
      projectId,
      detailKind: effectiveDetailTab.kind,
      templateId: effectiveDetailTab.templateId,
      whiteboardConfig: effectiveDetailTab.kind === 'whiteboard'
        ? {
            boardId: DEFAULT_FLOW_CANVAS_BOARD.boardId,
            title: effectiveDetailTab.label || GLOBAL_WHITEBOARD_LABEL,
          }
        : undefined,
      jumpToPage: effectiveDetailTab.jumpToPage,
      jumpToken: effectiveDetailTab.jumpToken,
      onJumpHandled: () => onClearDetailJump(effectiveDetailTab.key),
      onOpenVideoDetailTab: (docId: string, label: string) =>
        openResourceCenterVideoDetail(onOpenDetailTab, { docId, label }),
      onOpenResourceDetailTab: (docId: string, label?: string) =>
        openResourceCenterResourceDetail(onOpenDetailTab, { docId, label }),
      isDarkMode,
      toggleTheme,
      user,
      onLogout: handleLogout,
      disableTemplatePointerEvents,
    };
  }, [activeDetailTab, disableTemplatePointerEvents, handleLogout, isDarkMode, kbId, lastDetailTab, onClearDetailJump, onOpenDetailTab, projectId, toggleTheme, user]);

  const detailStates = useMemo(() => {
    return detailTabs.map((tab) => ({
      key: tab.key,
      state: {
        docId: tab.docId,
        detailTabKey: tab.key,
        kbId,
        projectId,
        detailKind: tab.kind,
        templateId: tab.templateId,
        whiteboardConfig: tab.kind === 'whiteboard'
          ? {
              boardId: DEFAULT_FLOW_CANVAS_BOARD.boardId,
              title: tab.label || GLOBAL_WHITEBOARD_LABEL,
            }
          : undefined,
        jumpToPage: tab.jumpToPage,
        jumpToken: tab.jumpToken,
        onJumpHandled: () => onClearDetailJump(tab.key),
        onOpenVideoDetailTab: (docId: string, label: string) =>
          openResourceCenterVideoDetail(onOpenDetailTab, { docId, label }),
        onOpenResourceDetailTab: (docId: string, label?: string) =>
          openResourceCenterResourceDetail(onOpenDetailTab, { docId, label }),
        isDarkMode,
        toggleTheme,
        user,
        onLogout: handleLogout,
        disableTemplatePointerEvents,
      }
    }));
  }, [detailTabs, disableTemplatePointerEvents, handleLogout, isDarkMode, kbId, onClearDetailJump, onOpenDetailTab, projectId, toggleTheme, user]);

  const fullscreenDetailTab = useMemo(() => {
    if (activePanel === 'ai' || isResourceCenterTab(String(activePanel))) {
      return null;
    }
    const key = String(activePanel);
    return detailTabs.find((tab) => tab.key === key) ?? null;
  }, [activePanel, detailTabs]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-white dark:bg-[#121212]">
      <header className="z-20 flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 bg-white/50 px-4 py-4 backdrop-blur-md dark:border-[#2a2a2a] dark:bg-[#121212]/80 md:px-6 lg:px-8 lg:py-5">
        <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-4">
          <TourStep
            tag={RESOURCE_CENTER_GUIDE_TAG}
            order={4}
            title="返回上一级"
            content="仅返回资源中心允许的来源页面；来源无效时回到工作区。"
            actionLabel="知道了"
          >
            <button
              type="button"
              onClick={() => {
                navigate(resolveResourceCenterBackTarget(projectId, location.state));
              }}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-colors hover:text-slate-700 dark:bg-[#1a1a1a] dark:text-[#e0e0e0] dark:hover:text-white"
              aria-label="返回上一级"
              title="返回上一级"
            >
              <MaterialIcon name="arrow_back" />
            </button>
          </TourStep>

          <button
            type="button"
            onClick={() => setIsMobileSearchOpen(true)}
            className="flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-primary hover:text-primary dark:border-[#2a2a2a] dark:bg-[#1a1a1a] dark:text-[#e0e0e0] md:hidden"
            aria-label="打开搜索弹窗"
            title="搜索资源"
          >
            <MaterialIcon name="search" className="text-xl" />
          </button>

          <div className="relative hidden md:block">
            <MaterialIcon
              name="search"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-xl text-slate-400"
            />
            <input
              type="text"
              value={search}
              onChange={(event) => dispatch(setSearch(event.target.value))}
              placeholder="搜索资源..."
              className="w-full min-w-0 rounded-xl border-none bg-slate-100 py-2 pl-10 pr-4 text-xs text-slate-700 outline-none transition-all focus:ring-1 focus:ring-primary dark:bg-[#1a1a1a] dark:text-[#e0e0e0] sm:w-56 lg:w-64"
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 md:gap-4">
          <TaskListButton projectId={projectId} kbId={kbId} compactOnMobile />
          <div className="hidden h-6 w-px bg-slate-200 dark:bg-[#2a2a2a] sm:block" />
          <ThemeToggle onToggle={toggleTheme} isDarkMode={isDarkMode} />
          <UserMenu user={user} onLogout={handleLogout} />
        </div>
      </header>

      <div className="group/header relative z-10 border-b border-slate-100 bg-white px-4 dark:border-[#2a2a2a] dark:bg-[#121212] md:px-6 lg:px-8">
        <div
          className={`transition-[max-height,opacity] duration-200 ease-out ${
            isTopTabsCollapsed
              ? 'pointer-events-none max-h-0 overflow-hidden opacity-0'
              : 'max-h-40 overflow-visible opacity-100'
          }`}
          aria-hidden={isTopTabsCollapsed}
          data-top-tabs-collapsed={isTopTabsCollapsed ? 'true' : 'false'}
        >
          <div className="relative py-4 pr-12 md:pr-16">
            <div className="min-w-0">
              <ResourceTopTabs
                topTabItems={topTabItems}
                detailTabGroups={detailTabGroups}
                activeTopPanel={activeTopPanel}
                activePanel={activePanel}
                activeListTab={activeTab}
                detailMergeDropZonePrefix={detailMergeDropZonePrefix}
                onSelectTopTab={onSelectTopTab}
                onCloseDetailTab={onCloseDetailTab}
                onCloseSingleDetailTab={onCloseSingleDetailTab}
              />
            </div>
            <button
              type="button"
              onClick={() => setIsShareModalOpen(true)}
              className="absolute right-0 top-3 inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-primary hover:text-primary dark:border-[#2a2a2a] dark:bg-[#171717] dark:text-[#d0d0d0] dark:hover:border-primary dark:hover:text-white md:top-4 md:px-4"
              aria-label="分享资源"
            >
              <MaterialIcon name="share" className="text-base" />
              <span className="hidden md:inline">分享</span>
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsTopTabsCollapsed((prev) => !prev)}
          className="absolute left-1/2 top-full z-20 inline-flex -translate-x-1/2 -translate-y-px items-center justify-center rounded-b-lg border border-t-0 border-slate-200 bg-white px-2 py-0.5 text-slate-400 opacity-0 shadow-sm transition-[opacity,color] duration-200 group-hover/header:opacity-100 group-focus-within/header:opacity-100 hover:text-primary focus-visible:opacity-100 focus-visible:outline-none dark:border-[#2a2a2a] dark:bg-[#121212] dark:text-[#8a8a8a] dark:hover:text-white dark:focus-visible:text-white"
          aria-label={isTopTabsCollapsed ? '展开顶部标签' : '收起顶部标签'}
          title={isTopTabsCollapsed ? '展开顶部标签' : '收起顶部标签'}
        >
          <MaterialIcon
            name={isTopTabsCollapsed ? 'keyboard_arrow_down' : 'keyboard_arrow_up'}
            className="text-xl"
          />
        </button>
      </div>

      <Modal
        isOpen={isMobileSearchOpen}
        title="搜索资源"
        onClose={() => setIsMobileSearchOpen(false)}
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700 dark:text-[#e0e0e0]">
              关键词
            </span>
            <div className="relative">
              <MaterialIcon
                name="search"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-xl text-slate-400"
              />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(event) => dispatch(setSearch(event.target.value))}
                placeholder="搜索资源..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-700 outline-none transition-colors focus:border-primary dark:border-[#2a2a2a] dark:bg-[#1a1a1a] dark:text-[#e0e0e0]"
              />
            </div>
          </label>
          <button
            type="button"
            onClick={() => setIsMobileSearchOpen(false)}
            className="inline-flex w-full items-center justify-center rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            完成
          </button>
        </div>
      </Modal>

      <ResourceCenterContent
        panel={activePanel}
        variant="main"
        listState={listState}
        listActions={{
          onOpenResource: handleResourceOpen,
          onOpenGlobalView: handleOpenGlobalWhiteboard,
          panelMetaByTab,
          onToggleReference: onToggleListReference,
          referencedDocIds,
          onResourceDeleted,
          onPageChange,
        }}
        detailState={detailState}
        detailStates={detailStates}
        detailFloatingAction={fullscreenDetailTab && projectId && kbId ? (
          <button
            type="button"
            onClick={() => {
              const targetPath = buildResourceDetailFullscreenPath(
                projectId,
                kbId,
                fullscreenDetailTab.kind,
                fullscreenDetailTab.docId,
                {
                  page: fullscreenDetailTab.jumpToPage,
                  jump: fullscreenDetailTab.jumpToken,
                }
              );
              navigate(targetPath, {
                state: buildResourceRouteState(currentPath),
              });
            }}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white/95 text-slate-500 shadow-md transition-colors hover:text-slate-700 dark:border-[#2a2a2a] dark:bg-[#1a1a1a]/95 dark:text-[#e0e0e0] dark:hover:text-white"
            aria-label="全屏查看当前详情"
            title="全屏查看"
          >
            <MaterialIcon name="open_in_full" />
          </button>
        ) : null}
        aiState={{
          resources: sidebarResources,
          referencedResources: sidebarReferencedResources,
          referencedDocRefs,
          onToggleReference: onToggleSidebarReference,
          onClearReferences,
          fallbackDocRef,
          showCollapseToggle: false,
        }}
      />

      <div className="fixed bottom-12 right-12 z-30 hidden lg:block">
        <ResourceActionMenu
          label="add"
          onGenerateKbview={() => setGenerateType('kbview')}
        />
      </div>
      <ResourceActionMenu
        variant="sheet"
        label="资源操作"
        isOpen={isMobileActionSheetOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeMobileActionSheet();
          }
        }}
        onGenerateKbview={() => setGenerateType('kbview')}
      />

      <ResourceImportModal projectId={projectId} />
      <ResourceImportTextModal projectId={projectId} />
      <ResourceImportUrlModal projectId={projectId} />

      {generateType && (
        <ResourceGenerateTaskModal
          key={`${generateType}:${projectId ?? 'none'}:${kbId ?? 'none'}`}
          isOpen={Boolean(generateType)}
          type={generateType}
          resources={docOptionsQuery.data ?? []}
          projectId={projectId}
          kbId={kbId}
          isLoading={docOptionsQuery.isLoading || kbdocListLoading}
          onClose={() => setGenerateType(null)}
        />
      )}
      <ResourceShareTokenModal
        isOpen={isShareModalOpen}
        resources={docOptionsQuery.data ?? []}
        projectId={projectId}
        kbId={kbId}
        isLoading={docOptionsQuery.isLoading || kbdocListLoading}
        onClose={() => setIsShareModalOpen(false)}
      />
    </div>
  );
};

export default ResourceCenterPage;
