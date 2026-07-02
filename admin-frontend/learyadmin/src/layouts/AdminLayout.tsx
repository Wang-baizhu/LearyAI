// 责任：承载管理后台整体布局并执行管理员会话守卫。
import React from 'react';
import {Outlet} from 'react-router-dom';
import {Sidebar} from './Sidebar';
import {Header} from './Header';
import {useAuth} from '@/modules/auth/hooks/useAuth';
import type {ApiClientError} from '@/shared/api/client';
import {Button} from '@/shared/components/Button';

export const AdminLayout: React.FC = () => {
  const {isLoading, isAdmin, error, refetch} = useAuth();
  const errorMessage = (error as ApiClientError | null)?.message;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center text-sm text-zinc-500">
        正在校验管理员会话...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-xl border border-rose-100 bg-white p-6 text-center space-y-3">
          <h1 className="text-xl font-semibold text-zinc-900">无管理员访问权限</h1>
          <p className="text-sm text-zinc-500">{errorMessage ?? '当前会话未通过 ADMIN 校验。'}</p>
          <Button onClick={() => refetch()}>重新校验</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-50 font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="p-8 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
