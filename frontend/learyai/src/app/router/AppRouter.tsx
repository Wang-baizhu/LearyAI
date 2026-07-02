// AppRouter 负责定义应用级路由树与页面入口装配。
import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthPage, ElectronAuthCompletePage, RequireAuth } from '@/modules/auth';
import { ProjectDetailPage } from '@/modules/project';
import { ResourceCenterLayout, ResourceCenterPage, ResourceDetailFullscreenPage } from '@/modules/resource';
import { WorkspacePage } from '@/modules/workspace';
import ThemeToggle from '@/shared/ui/ThemeToggle';

interface AppRouterProps {
  isDarkMode: boolean;
  onToggleTheme: () => void;
  sessionReady: boolean;
}

export const AppRouter: React.FC<AppRouterProps> = ({ isDarkMode, onToggleTheme, sessionReady }) => (
  <BrowserRouter>
    <Routes>
      <Route
        path="/"
        element={
          <div className="min-h-screen flex items-center justify-center p-4 bg-white dark:bg-[#121212] text-slate-900 dark:text-[#e0e0e0]">
            <div className="fixed top-safe-offset right-safe-offset z-50">
              <ThemeToggle onToggle={onToggleTheme} isDarkMode={isDarkMode} />
            </div>
            <AuthPage />
          </div>
        }
      />
      <Route path="/electron-auth-complete" element={<ElectronAuthCompletePage />} />
      <Route
        path="/workspace"
        element={
          <RequireAuth sessionReady={sessionReady}>
            <WorkspacePage />
          </RequireAuth>
        }
      />
      <Route
        path="/project/:projectId"
        element={
          <RequireAuth sessionReady={sessionReady}>
            <ProjectDetailPage />
          </RequireAuth>
        }
      />
      <Route
        path="/resource-center/:projectId/:kbId"
        element={
          <RequireAuth sessionReady={sessionReady}>
            <ResourceCenterLayout />
          </RequireAuth>
        }
      >
        <Route index element={<ResourceCenterPage />} />
      </Route>
      <Route
        path="/resource-center/:projectId/:kbId/fullscreen/:detailKind/:docId"
        element={
          <RequireAuth sessionReady={sessionReady}>
            <ResourceDetailFullscreenPage />
          </RequireAuth>
        }
      />
      <Route path="/workspace/resource-center/*" element={<Navigate to="/workspace" replace />} />
    </Routes>
  </BrowserRouter>
);
