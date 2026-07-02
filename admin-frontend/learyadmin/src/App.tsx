/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminLayout } from './layouts/AdminLayout';
import { DashboardPage } from './pages/DashboardPage';
import { UserPage } from './pages/UserPage';
import { UserSubscriptionCyclePage } from './pages/UserSubscriptionCyclePage';
import { UsagePage } from './pages/UsagePage';
import { InvitePage } from './pages/InvitePage';
import { RegisterInvitePage } from './pages/RegisterInvitePage';
import { TemplateDevPackagePage } from './pages/TemplateDevPackagePage';
import { ReviewTaskPage } from './pages/ReviewTaskPage';
import { TaskDlqPage } from './pages/TaskDlqPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AdminLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="users" element={<UserPage />} />
            <Route path="user-subscription-cycles" element={<UserSubscriptionCyclePage />} />
            <Route path="usage" element={<UsagePage />} />
            <Route path="invites" element={<InvitePage />} />
            <Route path="register-invites" element={<RegisterInvitePage />} />
            <Route path="task-dlq" element={<TaskDlqPage />} />
            <Route path="review-tasks" element={<ReviewTaskPage />} />
            <Route path="template-dev-packages" element={<TemplateDevPackagePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
