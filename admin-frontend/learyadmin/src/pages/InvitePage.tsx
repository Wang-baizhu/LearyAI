// 责任：提供管理员邀请码状态查询页面，展示邀请码分页列表与详情。
import React, {useMemo, useState} from 'react';
import {KeyRound} from 'lucide-react';
import {Card} from '@/shared/components/Card';
import {Badge} from '@/shared/components/Badge';
import {Button} from '@/shared/components/Button';
import {useInviteDetail, useInviteList} from '@/modules/invite/hooks/useInvite';
import type {AdminInviteStatus} from '@/shared/types/api';
import type {ApiClientError} from '@/shared/api/client';

const STATUS_OPTIONS: Array<{label: string; value: '' | AdminInviteStatus}> = [
  {label: '全部状态', value: ''},
  {label: 'ACTIVE', value: 'ACTIVE'},
  {label: 'USED_UP', value: 'USED_UP'},
  {label: 'EXPIRED', value: 'EXPIRED'},
  {label: 'REVOKED', value: 'REVOKED'},
];

const PAGE_SIZE = 20;

export const InvitePage: React.FC = () => {
  const [draftStatus, setDraftStatus] = useState<'' | AdminInviteStatus>('');
  const [draftProjectId, setDraftProjectId] = useState('');
  const [draftCreatorUserId, setDraftCreatorUserId] = useState('');
  const [selectedInviteId, setSelectedInviteId] = useState<number | undefined>(undefined);

  const [query, setQuery] = useState<{
    status?: AdminInviteStatus;
    projectId?: string;
    creatorUserId?: number;
    page: number;
    size: number;
  }>({
    page: 0,
    size: PAGE_SIZE,
  });

  const listQuery = useInviteList(query);
  const detailQuery = useInviteDetail(selectedInviteId);
  const listError = (listQuery.error as ApiClientError | null)?.message;
  const detailError = (detailQuery.error as ApiClientError | null)?.message;

  const parsedCreatorUserId = useMemo(() => {
    const value = Number(draftCreatorUserId);
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }, [draftCreatorUserId]);

  const total = listQuery.pageData?.total ?? 0;
  const hasPrev = query.page > 0;
  const hasNext = (query.page + 1) * PAGE_SIZE < total;

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setQuery({
      status: draftStatus || undefined,
      projectId: draftProjectId.trim() || undefined,
      creatorUserId: parsedCreatorUserId,
      page: 0,
      size: PAGE_SIZE,
    });
  };

  const goToPage = (nextPage: number) => {
    setQuery((prev) => ({...prev, page: nextPage}));
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">邀请码状态</h1>
          <p className="text-sm text-zinc-500 mt-1">展示邀请码分页列表与状态详情</p>
        </div>
      </div>

      <Card title="筛选条件">
        <form className="grid grid-cols-1 md:grid-cols-3 gap-3" onSubmit={submitSearch}>
          <label>
            <span className="block text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wider">状态 status</span>
            <select
              value={draftStatus}
              onChange={(event) => setDraftStatus(event.target.value as '' | AdminInviteStatus)}
              className="w-full px-3 py-2 bg-white border border-black/5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/5"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.label} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="block text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wider">项目 ID</span>
            <input
              type="text"
              value={draftProjectId}
              onChange={(event) => setDraftProjectId(event.target.value)}
              placeholder="可选"
              className="w-full px-3 py-2 bg-white border border-black/5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/5 font-mono"
            />
          </label>
          <label>
            <span className="block text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wider">创建者 userId</span>
            <input
              type="number"
              min={1}
              value={draftCreatorUserId}
              onChange={(event) => setDraftCreatorUserId(event.target.value)}
              placeholder="可选"
              className="w-full px-3 py-2 bg-white border border-black/5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/5"
            />
          </label>
          <div className="md:col-span-3">
            <Button type="submit" isLoading={listQuery.isFetching}>查询邀请码</Button>
          </div>
        </form>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="邀请码列表" extra={listQuery.pageData ? <Badge variant="info">{listQuery.pageData.total} 条</Badge> : null}>
          {listError ? <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">{listError}</div> : null}
          {listQuery.isLoading ? <p className="text-sm text-zinc-500">正在加载列表...</p> : null}

          {listQuery.pageData?.items.length ? (
            <div className="space-y-3">
              {listQuery.pageData.items.map((item) => (
                <button
                  key={item.inviteId}
                  type="button"
                  onClick={() => setSelectedInviteId(item.inviteId)}
                  className="w-full text-left rounded-lg border border-black/5 p-3 hover:bg-zinc-50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-zinc-500 font-mono">{item.inviteId}</p>
                    <Badge variant="success">{item.status}</Badge>
                  </div>
                  <p className="text-sm text-zinc-900 mt-2">projectId: {item.projectId}</p>
                  <p className="text-sm text-zinc-900 mt-1">creatorUserId: {item.creatorUserId}</p>
                  <p className="text-xs text-zinc-500 mt-1">used {item.usedCount} / max {item.maxUses}</p>
                </button>
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

        <Card
          title="邀请码详情"
          extra={selectedInviteId !== undefined ? <span className="text-xs text-zinc-500 font-mono">{selectedInviteId}</span> : <KeyRound size={14} className="text-zinc-400" />}
        >
          {selectedInviteId === undefined ? <p className="text-sm text-zinc-500">点击左侧列表项查看详情。</p> : null}
          {detailError ? <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">{detailError}</div> : null}
          {detailQuery.detail ? (
            <div className="space-y-2 text-sm text-zinc-900">
              <DetailRow label="inviteId" value={String(detailQuery.detail.inviteId)} mono />
              <DetailRow label="status" value={detailQuery.detail.status} />
              <DetailRow label="projectId" value={detailQuery.detail.projectId} mono />
              <DetailRow label="creatorUserId" value={String(detailQuery.detail.creatorUserId)} />
              <DetailRow label="usedCount/maxUses" value={`${detailQuery.detail.usedCount}/${detailQuery.detail.maxUses}`} />
              <DetailRow label="expiresAt" value={formatDateTime(detailQuery.detail.expiresAt)} />
              <DetailRow label="revokedAt" value={formatDateTime(detailQuery.detail.revokedAt)} />
              <DetailRow label="createdAt" value={formatDateTime(detailQuery.detail.createdAt)} />
              <DetailRow label="updatedAt" value={formatDateTime(detailQuery.detail.updatedAt)} />
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
};

const DetailRow: React.FC<{label: string; value: string; mono?: boolean}> = ({label, value, mono}) => (
  <div className="flex items-start justify-between gap-2">
    <p className="text-xs text-zinc-500 uppercase tracking-wider">{label}</p>
    <p className={`text-sm text-zinc-900 ${mono ? 'font-mono' : ''}`}>{value}</p>
  </div>
);

const formatDateTime = (value: string | null) => {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('zh-CN', {hour12: false});
};
