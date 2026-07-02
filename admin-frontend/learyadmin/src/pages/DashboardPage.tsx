// 责任：展示平台管理员仪表盘核心统计（用户总数 + 最近7天 usage 指标）。
import React, {useMemo} from 'react';
import {Activity, Users} from 'lucide-react';
import {useAuth} from '@/modules/auth/hooks/useAuth';
import {useUsageSummary} from '@/modules/usage/hooks/useUsage';
import {Card, StatCard} from '@/shared/components/Card';
import {ADMIN_USAGE_METRICS} from '@/shared/types/api';
import type {ApiClientError} from '@/shared/api/client';

export const DashboardPage: React.FC = () => {
  const {isLoading, error, totalUsers} = useAuth();
  const authErrorMessage = (error as ApiClientError | null)?.message;
  const usageWindow = useMemo(() => {
    const to = new Date();
    const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
    return {
      from: from.toISOString(),
      to: to.toISOString(),
    };
  }, []);
  const usageSummaryQuery = useUsageSummary({
    windowType: undefined,
    from: usageWindow.from,
    to: usageWindow.to,
  });
  const usageErrorMessage = (usageSummaryQuery.error as ApiClientError | null)?.message;
  const usageByMetric = useMemo(
    () =>
      usageSummaryQuery.metrics.reduce<Record<string, number>>((acc, item) => {
        acc[item.metric] = item.used;
        return acc;
      }, {}),
    [usageSummaryQuery.metrics],
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">平台概览</h1>
          <p className="text-sm text-zinc-500 mt-1">展示用户总数与最近7天 usage 指标</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
          {isLoading ? (
            <span>正在检查管理员会话...</span>
          ) : (
            <span>会话状态已更新</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatCard
          label="用户总数"
          value={isLoading ? '加载中' : totalUsers}
          icon={<Users size={20} />}
          description="来源：GET /api/admin/users/summary"
        />
        <StatCard
          label="最近7天 usage"
          value={usageSummaryQuery.isLoading ? '加载中' : `${usageSummaryQuery.metrics.length} 项`}
          icon={<Activity size={20} />}
          description="来源：GET /api/admin/usage/summary?from&to"
        />
      </div>

      {(authErrorMessage || usageErrorMessage) && (
        <div className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {authErrorMessage ? `用户统计加载失败：${authErrorMessage}` : null}
          {authErrorMessage && usageErrorMessage ? '；' : null}
          {usageErrorMessage ? `Usage 加载失败：${usageErrorMessage}` : null}
        </div>
      )}

      <Card title="最近7天 Usage 指标">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {ADMIN_USAGE_METRICS.map((metric) => (
            <div key={metric} className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
              <p className="text-xs text-zinc-500 break-all">{metric}</p>
              <p className="mt-1 text-xl font-semibold text-zinc-900">{usageByMetric[metric] ?? 0}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
