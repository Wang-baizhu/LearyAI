// ResourceDetailFullscreenPage 负责独立路由下的详情全屏展示与返回导航。
import React, { useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { DEFAULT_FLOW_CANVAS_BOARD } from '@/modules/flow-canvas';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';
import ThemeToggle from '@/shared/ui/ThemeToggle';
import UserMenu from '@/shared/ui/UserMenu';
import { authApi, useCurrentUser, useUserSession } from '../../../../auth';
import ResourceDetailPanel from '../../../features/resource-detail-panel';
import { useTheme } from '@/shared/contexts/useTheme';
import { usePreviewJump } from '../../../entities/resource-detail';
import {
  resolveResourceDetailFullscreenBackTarget,
} from '../../../route';

const ResourceDetailFullscreenPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { projectId, kbId, detailKind, docId } = useParams<{
    projectId: string;
    kbId: string;
    detailKind: string;
    docId: string;
  }>();
  const { setSession } = useUserSession();
  const user = useCurrentUser();
  const { isDarkMode, toggleTheme } = useTheme();
  const previewJump = usePreviewJump();
  const resolvedDocId = docId;
  const resolvedDetailKind = detailKind === 'kbdoc'
    ? 'kbdoc'
    : detailKind === 'video'
      ? 'video'
      : detailKind === 'whiteboard'
        ? 'whiteboard'
      : undefined;

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

  const handleBack = useCallback(() => {
    navigate(resolveResourceDetailFullscreenBackTarget(projectId, kbId, location.state), { replace: true });
  }, [kbId, location.state, navigate, projectId]);

  if (!resolvedDocId || !resolvedDetailKind) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white dark:bg-[#121212] text-slate-500 dark:text-[#a0a0a0]">
        无法定位详情资源。
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-white dark:bg-[#121212]">
      <header className="px-8 py-5 border-b border-slate-100 dark:border-[#2a2a2a] bg-white/50 dark:bg-[#121212]/80 backdrop-blur-md flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#1a1a1a] text-slate-500 hover:text-slate-700 dark:text-[#e0e0e0] dark:hover:text-white transition-colors"
            aria-label="返回上一级"
          >
            <MaterialIcon name="arrow_back" />
          </button>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle onToggle={toggleTheme} isDarkMode={isDarkMode} />
          <UserMenu user={user} onLogout={handleLogout} />
        </div>
      </header>
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <ResourceDetailPanel
          docId={resolvedDocId}
          kbId={kbId}
          projectId={projectId}
          variant="main"
          enableJump
          jumpToPage={previewJump.jumpToPage}
          jumpToken={previewJump.jumpToken}
          onJumpHandled={previewJump.onJumpHandled}
          detailKind={resolvedDetailKind}
          whiteboardConfig={resolvedDetailKind === 'whiteboard'
            ? {
                boardId: resolvedDocId,
                title: DEFAULT_FLOW_CANVAS_BOARD.title,
              }
            : undefined}
          // TODO: 当前全屏 URL 详情暂时刻意不暴露视频详情入口，后续补专用布局后再接入。
          isDarkMode={isDarkMode}
          toggleTheme={toggleTheme}
          user={user}
          onLogout={handleLogout}
        />
      </div>
    </div>
  );
};

export default ResourceDetailFullscreenPage;
