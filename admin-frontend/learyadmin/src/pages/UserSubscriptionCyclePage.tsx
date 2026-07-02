// 责任：提供管理员独立的用户会员周期与额度配置页面。
import React, {useMemo, useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {Clock3, Search, Users} from 'lucide-react';
import {Card} from '@/shared/components/Card';
import {Badge} from '@/shared/components/Badge';
import {Button} from '@/shared/components/Button';
import {UserSubscriptionCyclePanel} from '@/modules/user/components/UserSubscriptionCyclePanel';
import {useUserDetail, useUserRecentLogins} from '@/modules/user/hooks/useUser';
import type {ApiClientError} from '@/shared/api/client';

const PAGE_SIZE = 20;

export const UserSubscriptionCyclePage: React.FC = () => {
  const [page, setPage] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedUserIdRaw = searchParams.get('userId');
  const selectedUserId = useMemo(() => {
    const parsed = Number(selectedUserIdRaw || '');
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [selectedUserIdRaw]);
  const recentQuery = useUserRecentLogins({page, size: PAGE_SIZE});
  const userDetailQuery = useUserDetail(selectedUserId);
  const errorMessage = (recentQuery.error as ApiClientError | null)?.message;
  const userDetailError = (userDetailQuery.error as ApiClientError | null)?.message;
  const total = recentQuery.pageData?.total ?? 0;
  const hasPrev = page > 0;
  const hasNext = (page + 1) * PAGE_SIZE < total;
  const selectedUser = userDetailQuery.user;

  const handleSelectUser = (userId: number) => {
    setSearchParams({userId: String(userId)});
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">会员周期设置</h1>
          <p className="mt-1 text-sm text-zinc-500">在独立页面查看并更新用户会员周期、账期与用量限制</p>
        </div>
        <Badge variant="info">仅平台管理员可操作</Badge>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,1fr)]">
        <Card
          title="最近登录用户"
          extra={
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Clock3 size={14} />
              选择用户后在右侧维护会员周期
            </div>
          }
        >
          {errorMessage ? (
            <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage}</div>
          ) : null}
          {userDetailError ? (
            <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">{userDetailError}</div>
          ) : null}

          {recentQuery.isLoading ? <p className="text-sm text-zinc-500">正在加载最近登录列表...</p> : null}

          {recentQuery.pageData ? (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-black/5 text-left text-zinc-500">
                      <th className="py-2 pr-4">userId</th>
                      <th className="py-2 pr-4">姓名</th>
                      <th className="py-2 pr-4">邮箱</th>
                      <th className="py-2 pr-4">模式</th>
                      <th className="py-2 pr-4">最后登录</th>
                      <th className="py-2 pl-4 text-right">选择</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentQuery.pageData.items.map((item) => {
                      const isSelected = selectedUserId === item.userId;
                      return (
                        <tr key={`${item.userId}-${item.lastLoginAt ?? 'never'}`} className="border-b border-black/5">
                          <td className="py-2 pr-4 font-mono">{item.userId}</td>
                          <td className="py-2 pr-4">{item.name || '-'}</td>
                          <td className="py-2 pr-4">{item.email || item.phone || '-'}</td>
                          <td className="py-2 pr-4">{item.userMode || '-'}</td>
                          <td className="py-2 pr-4">{formatDateTime(item.lastLoginAt)}</td>
                          <td className="py-2 pl-4 text-right">
                            <Button
                              variant={isSelected ? 'secondary' : 'outline'}
                              size="sm"
                              className="gap-2"
                              onClick={() => handleSelectUser(item.userId)}
                            >
                              {isSelected ? <Users size={14} /> : <Search size={14} />}
                              {isSelected ? '当前用户' : '选择'}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-500">
                  page={recentQuery.pageData.page} size={recentQuery.pageData.size} total={recentQuery.pageData.total}
                </p>
                <div className="flex items-center gap-2">
                  <Button onClick={() => setPage((prev) => Math.max(0, prev - 1))} disabled={!hasPrev}>
                    上一页
                  </Button>
                  <Badge variant="info">第 {page + 1} 页</Badge>
                  <Button onClick={() => setPage((prev) => prev + 1)} disabled={!hasNext}>
                    下一页
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </Card>

        <UserSubscriptionCyclePanel selectedUser={selectedUser} />
      </div>
    </div>
  );
};

const formatDateTime = (value: string | null) => {
  if (!value) {
    return '未记录';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('zh-CN', {hour12: false});
};
