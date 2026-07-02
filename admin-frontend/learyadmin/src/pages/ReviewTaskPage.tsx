// 责任：提供管理端 listing 发布审核任务列表与人工审批入口。
import React, { useState } from 'react';
import { CheckCircle2, ClipboardCheck, RefreshCw } from 'lucide-react';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { useApproveReviewTask, useReviewTasks } from '@/modules/review-task/hooks/useReviewTask';
import type { ApiClientError } from '@/shared/api/client';
import type { AdminReviewTaskItemResponse, AdminReviewTaskItemType } from '@/shared/types/api';

const PAGE_SIZE = 20;
const ITEM_TYPE_OPTIONS: Array<{ value: 'ALL' | AdminReviewTaskItemType; label: string }> = [
  { value: 'ALL', label: '全部类型' },
  { value: 'KB', label: '知识库' },
  { value: 'TEMPLATE', label: '模板' },
  { value: 'PLUGIN', label: '插件' },
];

const itemTypeLabel = (itemType: string) => {
  if (itemType === 'KB') return '知识库';
  if (itemType === 'TEMPLATE') return '模板';
  if (itemType === 'PLUGIN') return '插件';
  return itemType;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
};

const shortId = (value?: string | null) => {
  if (!value) return '-';
  return value.length > 12 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
};

const ReviewTaskRow: React.FC<{
  item: AdminReviewTaskItemResponse;
  approvingId?: string;
  onApprove: (reviewTaskId: string) => void;
}> = ({ item, approvingId, onApprove }) => {
  const isApproving = approvingId === item.reviewTaskId;
  const reviewTaskId = item.reviewTaskId ?? '';
  return (
    <div className="rounded-xl border border-black/5 bg-white p-4 transition-colors hover:border-zinc-200">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">{itemTypeLabel(item.itemType ?? '-')}</Badge>
            <Badge variant={item.status === 'PENDING' ? 'warning' : 'success'}>
              {item.status === 'PENDING' ? '待审核' : '已通过'}
            </Badge>
            <span className="text-xs text-zinc-400">提交于 {formatDateTime(item.submittedAt)}</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Listing ID：{shortId(item.listingId)}</h3>
            <p className="mt-1 text-xs text-zinc-500">
              审核任务 {shortId(reviewTaskId)}{item.sourceId ? ` · 资源 ${shortId(item.sourceId)}` : ''}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          isLoading={isApproving}
          disabled={item.status !== 'PENDING' || !reviewTaskId}
          onClick={() => onApprove(reviewTaskId)}
        >
          <CheckCircle2 size={14} className="mr-2" />
          审批通过
        </Button>
      </div>
    </div>
  );
};

export const ReviewTaskPage: React.FC = () => {
  const [page, setPage] = useState(0);
  const [activeItemType, setActiveItemType] = useState<'ALL' | AdminReviewTaskItemType>('ALL');
  const tasksQuery = useReviewTasks({
    status: 'PENDING',
    itemType: activeItemType === 'ALL' ? undefined : activeItemType,
    page,
    size: PAGE_SIZE,
  });
  const approveMutation = useApproveReviewTask();
  const listError = (tasksQuery.error as ApiClientError | null)?.message;
  const approveError = (approveMutation.error as ApiClientError | null)?.message;
  const totalPages = Math.max(1, Math.ceil(tasksQuery.page.total / PAGE_SIZE));

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Listing 发布审核</h1>
          <p className="mt-1 text-sm text-zinc-500">人工确认 listing 是否允许进入市场。审批通过后，服务端会自动把对应 listing 置为已上架。</p>
        </div>
        <Button variant="secondary" onClick={() => tasksQuery.refetch()} isLoading={tasksQuery.isFetching}>
          <RefreshCw size={14} className="mr-2" />
          刷新
        </Button>
      </div>

      <Card
        title="待审核任务"
        extra={<span className="text-xs text-zinc-400">共 {tasksQuery.page.total} 条</span>}
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {ITEM_TYPE_OPTIONS.map((option) => {
            const active = activeItemType === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setActiveItemType(option.value);
                  setPage(0);
                }}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'border-zinc-900 bg-zinc-900 text-white'
                    : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        {listError ? <p className="mb-4 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">{listError}</p> : null}
        {approveError ? <p className="mb-4 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">{approveError}</p> : null}
        {tasksQuery.isLoading ? <p className="text-sm text-zinc-500">审核任务加载中...</p> : null}
        {!tasksQuery.isLoading && tasksQuery.page.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 py-14 text-center">
            <ClipboardCheck size={32} className="text-zinc-300" />
            <p className="mt-3 text-sm font-medium text-zinc-700">暂无待审核 listing</p>
            <p className="mt-1 text-xs text-zinc-400">作者提交审核后会出现在这里。</p>
          </div>
        ) : null}
        {tasksQuery.page.items.length > 0 ? (
          <div className="space-y-3">
            {tasksQuery.page.items.map((item) => (
              <ReviewTaskRow
                key={item.reviewTaskId ?? `${item.itemType}-${item.sourceId}`}
                item={item}
                approvingId={approveMutation.variables}
                onApprove={(reviewTaskId) => approveMutation.mutate(reviewTaskId)}
              />
            ))}
          </div>
        ) : null}
        <div className="mt-5 flex items-center justify-between text-xs text-zinc-500">
          <span>第 {page + 1} / {totalPages} 页</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>
              上一页
            </Button>
            <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage((value) => value + 1)}>
              下一页
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
