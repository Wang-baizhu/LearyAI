// 责任：提供管理端任务 DLQ 事故记录列表，支持查看错误信息、更新状态和删除。
import React, { useState } from 'react';
import { RefreshCw, ShieldAlert, Trash2 } from 'lucide-react';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import {
  useDeleteTaskDlqIncident,
  useTaskDlqIncidentList,
  useUpdateTaskDlqIncidentStatus,
} from '@/modules/task-dlq/hooks/useTaskDlq';
import type { ApiClientError } from '@/shared/api/client';
import type { AdminTaskDlqIncidentItemResponse, AdminTaskDlqIncidentStatus, AdminTaskDlqType } from '@/shared/types/api';

const PAGE_SIZE = 20;

const STATUS_OPTIONS: Array<{ label: string; value: '' | AdminTaskDlqIncidentStatus }> = [
  { label: '全部状态', value: '' },
  { label: 'OPEN', value: 'OPEN' },
  { label: 'COMPENSATED', value: 'COMPENSATED' },
  { label: 'RESOLVED', value: 'RESOLVED' },
  { label: 'IGNORED', value: 'IGNORED' },
];

const DLQ_TYPE_OPTIONS: Array<{ label: string; value: '' | AdminTaskDlqType }> = [
  { label: '全部类型', value: '' },
  { label: 'COMMAND', value: 'COMMAND' },
  { label: 'STATUS', value: 'STATUS' },
];

const STATUS_BADGE: Record<AdminTaskDlqIncidentStatus, 'warning' | 'success' | 'neutral' | 'info'> = {
  OPEN: 'warning',
  COMPENSATED: 'info',
  RESOLVED: 'success',
  IGNORED: 'neutral',
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('zh-CN', { hour12: false });
};

const shortText = (value: string | null | undefined, max = 24) => {
  if (!value) {
    return '-';
  }
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max)}...`;
};

export const TaskDlqPage: React.FC = () => {
  const [draftIncidentStatus, setDraftIncidentStatus] = useState<'' | AdminTaskDlqIncidentStatus>('');
  const [draftDlqType, setDraftDlqType] = useState<'' | AdminTaskDlqType>('');
  const [query, setQuery] = useState<{
    incidentStatus?: AdminTaskDlqIncidentStatus;
    dlqType?: AdminTaskDlqType;
    page: number;
    size: number;
  }>({
    page: 0,
    size: PAGE_SIZE,
  });
  const listQuery = useTaskDlqIncidentList(query);
  const updateStatusMutation = useUpdateTaskDlqIncidentStatus();
  const deleteMutation = useDeleteTaskDlqIncident();

  const listError = (listQuery.error as ApiClientError | null)?.message;
  const updateError = (updateStatusMutation.error as ApiClientError | null)?.message;
  const deleteError = (deleteMutation.error as ApiClientError | null)?.message;
  const total = listQuery.pageData?.total ?? 0;
  const hasPrev = query.page > 0;
  const hasNext = (query.page + 1) * PAGE_SIZE < total;

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setQuery({
      incidentStatus: draftIncidentStatus || undefined,
      dlqType: draftDlqType || undefined,
      page: 0,
      size: PAGE_SIZE,
    });
  };

  const goToPage = (nextPage: number) => {
    setQuery((prev) => ({ ...prev, page: nextPage }));
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">任务 DLQ 记录</h1>
          <p className="mt-1 text-sm text-zinc-500">查看死信事故、错误信息和补偿状态，并执行人工处理或清理。</p>
        </div>
        <Button variant="secondary" onClick={() => listQuery.refetch()} isLoading={listQuery.isFetching}>
          <RefreshCw size={14} className="mr-2" />
          刷新
        </Button>
      </div>

      <Card title="筛选条件">
        <form className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]" onSubmit={submitSearch}>
          <label>
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">状态</span>
            <select
              value={draftIncidentStatus}
              onChange={(event) => setDraftIncidentStatus(event.target.value as '' | AdminTaskDlqIncidentStatus)}
              className="w-full rounded-lg border border-black/5 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/5"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">DLQ 类型</span>
            <select
              value={draftDlqType}
              onChange={(event) => setDraftDlqType(event.target.value as '' | AdminTaskDlqType)}
              className="w-full rounded-lg border border-black/5 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/5"
            >
              {DLQ_TYPE_OPTIONS.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <Button type="submit" isLoading={listQuery.isFetching}>查询记录</Button>
          </div>
        </form>
      </Card>

      <Card title="事故列表" extra={<Badge variant="info">{total} 条</Badge>}>
        {listError ? <div className="mb-4 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">{listError}</div> : null}
        {updateError ? <div className="mb-4 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">{updateError}</div> : null}
        {deleteError ? <div className="mb-4 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">{deleteError}</div> : null}
        {listQuery.isLoading ? <p className="text-sm text-zinc-500">正在加载 DLQ 记录...</p> : null}

        {!listQuery.isLoading && !listQuery.pageData?.items.length ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 py-14 text-center">
            <ShieldAlert size={32} className="text-zinc-300" />
            <p className="mt-3 text-sm font-medium text-zinc-700">暂无 DLQ 记录</p>
            <p className="mt-1 text-xs text-zinc-400">当 MQ 重试耗尽后，死信事故会出现在这里。</p>
          </div>
        ) : null}

        {listQuery.pageData?.items.length ? (
          <div className="space-y-4">
            {listQuery.pageData.items.map((item) => (
              <TaskDlqIncidentRow
                key={item.incidentId}
                item={item}
                isUpdating={updateStatusMutation.isPending && updateStatusMutation.variables?.incidentId === item.incidentId}
                isDeleting={deleteMutation.isPending && deleteMutation.variables === item.incidentId}
                onResolve={() => updateStatusMutation.mutate({ incidentId: item.incidentId, incidentStatus: 'RESOLVED' })}
                onIgnore={() => updateStatusMutation.mutate({ incidentId: item.incidentId, incidentStatus: 'IGNORED' })}
                onReopen={() => updateStatusMutation.mutate({ incidentId: item.incidentId, incidentStatus: 'OPEN' })}
                onDelete={() => deleteMutation.mutate(item.incidentId)}
              />
            ))}

            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-zinc-500">page={query.page} size={PAGE_SIZE} total={total}</p>
              <div className="flex items-center gap-2">
                <Button onClick={() => goToPage(Math.max(0, query.page - 1))} disabled={!hasPrev}>上一页</Button>
                <Badge variant="info">第 {query.page + 1} 页</Badge>
                <Button onClick={() => goToPage(query.page + 1)} disabled={!hasNext}>下一页</Button>
              </div>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
};

const TaskDlqIncidentRow: React.FC<{
  item: AdminTaskDlqIncidentItemResponse;
  isUpdating: boolean;
  isDeleting: boolean;
  onResolve: () => void;
  onIgnore: () => void;
  onReopen: () => void;
  onDelete: () => void;
}> = ({ item, isUpdating, isDeleting, onResolve, onIgnore, onReopen, onDelete }) => (
  <div className="rounded-xl border border-black/5 bg-white p-4">
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={STATUS_BADGE[item.incidentStatus as AdminTaskDlqIncidentStatus] ?? 'neutral'}>
              {item.incidentStatus}
            </Badge>
            <Badge variant="info">{item.dlqType ?? '-'}</Badge>
            <span className="text-xs text-zinc-400">创建于 {formatDateTime(item.createdAt)}</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">错误信息</h3>
            <p className="mt-1 whitespace-pre-wrap break-words rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {item.errorMessage || '无错误详情'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            isLoading={isUpdating}
            disabled={item.incidentStatus === 'RESOLVED' || isDeleting}
            onClick={onResolve}
          >
            标记已处理
          </Button>
          <Button
            size="sm"
            variant="outline"
            isLoading={isUpdating}
            disabled={item.incidentStatus === 'IGNORED' || isDeleting}
            onClick={onIgnore}
          >
            忽略
          </Button>
          <Button
            size="sm"
            variant="ghost"
            isLoading={isUpdating}
            disabled={item.incidentStatus === 'OPEN' || isDeleting}
            onClick={onReopen}
          >
            重新打开
          </Button>
          <Button size="sm" variant="danger" isLoading={isDeleting} disabled={isUpdating} onClick={onDelete}>
            <Trash2 size={14} className="mr-1" />
            删除
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 text-sm text-zinc-600 md:grid-cols-2 xl:grid-cols-4">
        <MetaItem label="incidentId" value={String(item.incidentId)} mono />
        <MetaItem label="messageId" value={shortText(item.messageId, 32)} mono title={item.messageId ?? undefined} />
        <MetaItem label="sourceQueue" value={item.sourceQueue || '-'} />
        <MetaItem label="routingKey" value={item.sourceRoutingKey || '-'} />
        <MetaItem label="taskRecordId" value={item.taskRecordId ? String(item.taskRecordId) : '-'} />
        <MetaItem label="parentTaskRecordId" value={item.parentTaskRecordId ? String(item.parentTaskRecordId) : '-'} />
        <MetaItem label="projectId" value={shortText(item.projectId, 24)} title={item.projectId ?? undefined} mono />
        <MetaItem label="kbId" value={shortText(item.kbId, 24)} title={item.kbId ?? undefined} mono />
        <MetaItem label="stageRunKey" value={shortText(item.stageRunKey, 24)} title={item.stageRunKey ?? undefined} mono />
        <MetaItem label="taskType" value={item.taskType || '-'} />
        <MetaItem label="retryCount" value={item.retryCount !== null && item.retryCount !== undefined ? String(item.retryCount) : '-'} />
        <MetaItem label="compensationAction" value={item.compensationAction || '-'} />
      </div>

      <details className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium text-zinc-700">查看原始 payload</summary>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all text-xs text-zinc-600">
          {item.payloadJson || '无 payload'}
        </pre>
      </details>
    </div>
  </div>
);

const MetaItem: React.FC<{ label: string; value: string; mono?: boolean; title?: string }> = ({ label, value, mono, title }) => (
  <div className="space-y-1">
    <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{label}</p>
    <p className={`break-all text-sm text-zinc-700 ${mono ? 'font-mono' : ''}`} title={title}>
      {value}
    </p>
  </div>
);
