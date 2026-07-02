// 责任：提供管理员 usage 汇总、当前周期额度与事件明细查询页面。
import React, {useMemo, useState} from 'react';
import {Activity, Database, Gauge, Layers, ListOrdered} from 'lucide-react';
import {Card} from '@/shared/components/Card';
import {Badge} from '@/shared/components/Badge';
import {Button} from '@/shared/components/Button';
import {useUsageCurrentCycle, useUsageEventList, useUsageSummary} from '@/modules/usage/hooks/useUsage';
import type {
  UsageCurrentCycleParams,
  UsageEventListParams,
  UsageSummaryParams,
} from '@/modules/usage/api/usage.api';
import {ADMIN_USAGE_METRICS, type AdminUsageWindowType} from '@/shared/types/api';
import type {ApiClientError} from '@/shared/api/client';

const WINDOW_OPTIONS: Array<{label: string; value: AdminUsageWindowType}> = [
  {label: '最近 24 小时', value: 'last_24_hours'},
  {label: '最近 30 天', value: 'last_30_days'},
];

const PAGE_SIZE = 20;

export const UsagePage: React.FC = () => {
  const [draftWindowType, setDraftWindowType] = useState<AdminUsageWindowType>('last_24_hours');
  const [draftFrom, setDraftFrom] = useState('');
  const [draftTo, setDraftTo] = useState('');
  const [draftUserId, setDraftUserId] = useState('');
  const [draftProjectId, setDraftProjectId] = useState('');
  const [draftMetric, setDraftMetric] = useState('');

  const [summaryParams, setSummaryParams] = useState<UsageSummaryParams | null>(null);
  const [currentCycleParams, setCurrentCycleParams] = useState<UsageCurrentCycleParams | null>(null);
  const [listParams, setListParams] = useState<UsageEventListParams | null>(null);

  const summaryQuery = useUsageSummary(summaryParams);
  const currentCycleQuery = useUsageCurrentCycle(currentCycleParams);
  const listQuery = useUsageEventList(listParams);

  const parsedUserId = useMemo(() => {
    const value = Number(draftUserId);
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }, [draftUserId]);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();

    const normalizedProjectId = draftProjectId.trim() || undefined;
    const normalizedMetric = draftMetric.trim() || undefined;
    const normalizedFrom = draftFrom ? new Date(draftFrom).toISOString() : undefined;
    const normalizedTo = draftTo ? new Date(draftTo).toISOString() : undefined;
    const resolvedWindowType = normalizedFrom || normalizedTo ? undefined : draftWindowType;

    const nextSummary: UsageSummaryParams = {
      windowType: resolvedWindowType,
      from: normalizedFrom,
      to: normalizedTo,
      userId: parsedUserId,
      projectId: normalizedProjectId,
    };
    const nextList: UsageEventListParams = {
      windowType: resolvedWindowType,
      from: normalizedFrom,
      to: normalizedTo,
      userId: parsedUserId,
      projectId: normalizedProjectId,
      metric: normalizedMetric,
      page: 0,
      size: PAGE_SIZE,
    };

    setSummaryParams(nextSummary);
    setCurrentCycleParams(
      parsedUserId && normalizedProjectId && normalizedMetric
        ? {
            userId: parsedUserId,
            projectId: normalizedProjectId,
            metric: normalizedMetric,
          }
        : null,
    );
    setListParams(nextList);
  };

  const summaryError = (summaryQuery.error as ApiClientError | null)?.message;
  const currentCycleError = (currentCycleQuery.error as ApiClientError | null)?.message;
  const listError = (listQuery.error as ApiClientError | null)?.message;
  const listTotal = listQuery.pageData?.total ?? 0;
  const listPage = listParams?.page ?? 0;
  const hasPrev = listPage > 0;
  const hasNext = (listPage + 1) * PAGE_SIZE < listTotal;

  const goToPage = (nextPage: number) => {
    if (!listParams) {
      return;
    }
    setListParams({...listParams, page: nextPage});
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">资源用量</h1>
          <p className="text-sm text-zinc-500 mt-1">展示 usage 汇总、当前周期剩余额度与 usage_event 分页明细</p>
        </div>
      </div>

      <Card title="查询条件">
        <form className="grid grid-cols-1 gap-3 md:grid-cols-3" onSubmit={handleSearch}>
          <label>
            <span className="block text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wider">窗口 windowType</span>
            <select
              value={draftWindowType}
              onChange={(event) => setDraftWindowType(event.target.value as AdminUsageWindowType)}
              className="w-full px-3 py-2 bg-white border border-black/5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/5"
            >
              {WINDOW_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="block text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wider">开始时间 from</span>
            <input
              type="datetime-local"
              value={draftFrom}
              onChange={(event) => setDraftFrom(event.target.value)}
              className="w-full px-3 py-2 bg-white border border-black/5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/5"
            />
          </label>

          <label>
            <span className="block text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wider">结束时间 to</span>
            <input
              type="datetime-local"
              value={draftTo}
              onChange={(event) => setDraftTo(event.target.value)}
              className="w-full px-3 py-2 bg-white border border-black/5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/5"
            />
          </label>

          <label>
            <span className="block text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wider">用户 ID (可选)</span>
            <input
              type="number"
              min={1}
              value={draftUserId}
              onChange={(event) => setDraftUserId(event.target.value)}
              placeholder="不填表示全平台"
              className="w-full px-3 py-2 bg-white border border-black/5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/5"
            />
          </label>

          <label>
            <span className="block text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wider">项目 ID (可选)</span>
            <input
              type="text"
              value={draftProjectId}
              onChange={(event) => setDraftProjectId(event.target.value)}
              placeholder="不填表示全平台"
              className="w-full px-3 py-2 bg-white border border-black/5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/5 font-mono"
            />
          </label>

          <label>
            <span className="block text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wider">指标 metric (可选)</span>
            <select
              value={draftMetric}
              onChange={(event) => setDraftMetric(event.target.value)}
              className="w-full px-3 py-2 bg-white border border-black/5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/5"
            >
              <option value="">全部指标</option>
              {ADMIN_USAGE_METRICS.map((metric) => (
                <option key={metric} value={metric}>{metric}</option>
              ))}
            </select>
          </label>

          <div className="md:col-span-3">
            <Button type="submit" isLoading={summaryQuery.isFetching || currentCycleQuery.isFetching || listQuery.isFetching}>
              查询用量
            </Button>
          </div>
        </form>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card title="Usage 汇总" extra={summaryParams?.windowType ? <Badge variant="info">{summaryParams.windowType}</Badge> : null}>
          {!summaryParams ? <p className="text-sm text-zinc-500">请输入查询条件后执行。</p> : null}
          {summaryError ? <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">{summaryError}</div> : null}
          {summaryQuery.metrics.length > 0 ? (
            <div className="space-y-4">
              {summaryQuery.metrics.map((item) => (
                <div key={item.metric} className="rounded-lg border border-black/5 p-3">
                  <MetricRow icon={<Gauge size={14} />} label="Metric" value={item.metric} />
                  <MetricRow icon={<Activity size={14} />} label="Used" value={String(item.used)} />
                  <MetricRow icon={<Database size={14} />} label="Quota" value={String(item.quota)} />
                  <MetricRow icon={<Layers size={14} />} label="Available" value={String(item.available)} />
                </div>
              ))}
            </div>
          ) : null}
        </Card>

        <Card title="当前周期额度" extra={currentCycleQuery.currentCycle ? <Badge variant="success">{currentCycleQuery.currentCycle.metric}</Badge> : null}>
          {!currentCycleParams ? (
            <p className="text-sm text-zinc-500">填写 `userId + projectId + metric` 后可查询当前周期额度。</p>
          ) : null}
          {currentCycleError ? (
            <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">{currentCycleError}</div>
          ) : null}
          {currentCycleQuery.currentCycle ? (
            <div className="space-y-4 rounded-lg border border-black/5 p-3">
              <MetricRow icon={<Gauge size={14} />} label="Metric" value={currentCycleQuery.currentCycle.metric} />
              <MetricRow icon={<Activity size={14} />} label="Used" value={String(currentCycleQuery.currentCycle.used)} />
              <MetricRow icon={<ListOrdered size={14} />} label="Reserved" value={String(currentCycleQuery.currentCycle.reserved)} />
              <MetricRow icon={<Database size={14} />} label="Quota" value={String(currentCycleQuery.currentCycle.quota)} />
              <MetricRow icon={<Layers size={14} />} label="Available" value={String(currentCycleQuery.currentCycle.available)} />
              <p className="text-xs text-zinc-500">cycleId={currentCycleQuery.currentCycle.cycleId}</p>
              <p className="text-xs text-zinc-500">
                {formatDateTime(currentCycleQuery.currentCycle.validFrom)} ~ {formatDateTime(currentCycleQuery.currentCycle.validTo)}
              </p>
              <p className="text-xs text-zinc-500">updatedAt={formatDateTime(currentCycleQuery.currentCycle.updatedAt)}</p>
            </div>
          ) : null}
        </Card>

        <Card title="Usage 事件分页明细" extra={listQuery.pageData ? <Badge variant="success">{listQuery.pageData.total} 条</Badge> : null}>
          {!listParams ? <p className="text-sm text-zinc-500">请输入查询条件后执行。</p> : null}
          {listError ? <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">{listError}</div> : null}
          {listQuery.pageData?.items.length ? (
            <div className="space-y-3">
              {listQuery.pageData.items.map((item, index) => (
                <div key={`${item.userId}-${item.projectId}-${item.metric}-${index}`} className="rounded-lg border border-black/5 p-3">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{item.metric}</p>
                  <p className="text-sm text-zinc-900 mt-1">userId {item.userId} / projectId {item.projectId}</p>
                  <p className="text-sm text-zinc-900 mt-1">delta {item.delta} / sourceType {item.sourceType}</p>
                  <p className="text-xs text-zinc-500 mt-1">sourceId={item.sourceId}</p>
                  <p className="text-xs text-zinc-500 mt-1">idempotencyKey={item.idempotencyKey}</p>
                  <p className="text-xs text-zinc-500 mt-1">occurredAt={formatDateTime(item.occurredAt)}</p>
                  <p className="text-xs text-zinc-500 mt-1">createdAt={formatDateTime(item.createdAt)}</p>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-zinc-500">
                  page={listQuery.pageData.page} size={listQuery.pageData.size} total={listQuery.pageData.total}
                </p>
                <div className="flex items-center gap-2">
                  <Button onClick={() => goToPage(Math.max(0, listPage - 1))} disabled={!hasPrev}>
                    上一页
                  </Button>
                  <Badge variant="info">第 {listPage + 1} 页</Badge>
                  <Button onClick={() => goToPage(listPage + 1)} disabled={!hasNext}>
                    下一页
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
};

const MetricRow: React.FC<{icon: React.ReactNode; label: string; value: string}> = ({icon, label, value}) => (
  <div className="flex items-start justify-between gap-3">
    <div className="flex items-center gap-2 text-xs text-zinc-500 uppercase tracking-wider">
      <span>{icon}</span>
      <span>{label}</span>
    </div>
    <div className="text-sm text-zinc-900 text-right">{value}</div>
  </div>
);

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('zh-CN', {hour12: false});
};
