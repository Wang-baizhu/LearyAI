// 责任：提供管理员用户统计页面，展示总用户数与最近登录列表。
import React, {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {Settings2, Users} from 'lucide-react';
import {Card} from '@/shared/components/Card';
import {Badge} from '@/shared/components/Badge';
import {Button} from '@/shared/components/Button';
import {useUserRecentLogins, useUserSummary} from '@/modules/user/hooks/useUser';
import type {ApiClientError} from '@/shared/api/client';

const PAGE_SIZE = 20;

export const UserPage: React.FC = () => {
  const [page, setPage] = useState(0);
  const navigate = useNavigate();
  const summaryQuery = useUserSummary();
  const recentQuery = useUserRecentLogins({page, size: PAGE_SIZE});
  const errorMessage = (recentQuery.error as ApiClientError | null)?.message;
  const total = recentQuery.pageData?.total ?? 0;
  const hasPrev = page > 0;
  const hasNext = (page + 1) * PAGE_SIZE < total;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">用户管理</h1>
          <p className="mt-1 text-sm text-zinc-500">展示用户总数与最近登录用户列表</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => navigate('/user-subscription-cycles')}>
          <Settings2 size={16} />
          会员周期设置页
        </Button>
      </div>

      <Card title="用户统计">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-50 text-zinc-500">
            <Users size={20} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">总用户数</p>
            <p className="text-2xl font-semibold text-zinc-900">{summaryQuery.summary?.totalUsers ?? '-'}</p>
          </div>
        </div>
      </Card>

      <Card title="最近登录用户" extra={<span className="text-xs text-zinc-500">按 lastLoginAt DESC, userId DESC</span>}>
        {errorMessage ? (
          <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage}</div>
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
                    <th className="py-2 pr-4">手机号</th>
                    <th className="py-2 pr-4">模式</th>
                    <th className="py-2 pr-4">最后登录</th>
                    <th className="py-2 pl-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {recentQuery.pageData.items.map((item) => (
                    <tr key={`${item.userId}-${item.lastLoginAt ?? 'never'}`} className="border-b border-black/5">
                      <td className="py-2 pr-4 font-mono">{item.userId}</td>
                      <td className="py-2 pr-4">{item.name || '-'}</td>
                      <td className="py-2 pr-4">{item.email || '-'}</td>
                      <td className="py-2 pr-4">{item.phone || '-'}</td>
                      <td className="py-2 pr-4">{item.userMode || '-'}</td>
                      <td className="py-2 pr-4">{formatDateTime(item.lastLoginAt)}</td>
                      <td className="py-2 pl-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => navigate(`/user-subscription-cycles?userId=${item.userId}`)}
                        >
                          <Settings2 size={14} />
                          会员设置
                        </Button>
                      </td>
                    </tr>
                  ))}
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
