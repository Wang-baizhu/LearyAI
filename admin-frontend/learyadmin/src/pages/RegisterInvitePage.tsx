// 责任：提供管理员注册邀请码管理页面，支持查询、创建、停用、删除与详情查看。
import React, {useEffect, useRef, useState} from 'react';
import {Check, Copy, Ticket} from 'lucide-react';
import {Card} from '@/shared/components/Card';
import {Badge} from '@/shared/components/Badge';
import {Button} from '@/shared/components/Button';
import {
  useCreateRegisterInvite,
  useDeactivateRegisterInvite,
  useDeleteRegisterInvite,
  useRegisterInviteDetail,
  useRegisterInviteList,
} from '@/modules/register-invite/hooks/useRegisterInvite';
import type {AdminRegisterInviteStatus} from '@/shared/types/api';
import type {ApiClientError} from '@/shared/api/client';

const STATUS_OPTIONS: Array<{label: string; value: '' | AdminRegisterInviteStatus}> = [
  {label: '全部状态', value: ''},
  {label: 'ACTIVE', value: 'ACTIVE'},
  {label: 'INACTIVE', value: 'INACTIVE'},
  {label: 'USED', value: 'USED'},
];

const PAGE_SIZE = 20;

export const RegisterInvitePage: React.FC = () => {
  const [draftStatus, setDraftStatus] = useState<'' | AdminRegisterInviteStatus>('');
  const [draftCode, setDraftCode] = useState('');
  const [draftCount, setDraftCount] = useState('1');
  const [selectedInviteId, setSelectedInviteId] = useState<number | undefined>(undefined);
  const [copiedInviteId, setCopiedInviteId] = useState<number | null>(null);
  const [query, setQuery] = useState<{status?: AdminRegisterInviteStatus; page: number; size: number}>({
    page: 0,
    size: PAGE_SIZE,
  });
  const copyResetTimerRef = useRef<number | null>(null);

  const listQuery = useRegisterInviteList(query);
  const detailQuery = useRegisterInviteDetail(selectedInviteId);
  const createMutation = useCreateRegisterInvite();
  const deactivateMutation = useDeactivateRegisterInvite();
  const deleteMutation = useDeleteRegisterInvite();

  const listError = (listQuery.error as ApiClientError | null)?.message;
  const detailError = (detailQuery.error as ApiClientError | null)?.message;
  const createError = (createMutation.error as ApiClientError | null)?.message;
  const total = listQuery.pageData?.total ?? 0;
  const hasPrev = query.page > 0;
  const hasNext = (query.page + 1) * PAGE_SIZE < total;

  useEffect(() => () => {
    if (copyResetTimerRef.current !== null) {
      window.clearTimeout(copyResetTimerRef.current);
    }
  }, []);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setQuery({
      status: draftStatus || undefined,
      page: 0,
      size: PAGE_SIZE,
    });
  };

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedCount = Number(draftCount);
    createMutation.mutate(
      {
        code: draftCode.trim() || undefined,
        count: Number.isFinite(normalizedCount) ? normalizedCount : undefined,
      },
      {
        onSuccess: (response) => {
          setDraftCode('');
          setDraftCount('1');
          setSelectedInviteId(response.data[0]?.inviteId);
        },
      }
    );
  };

  const goToPage = (nextPage: number) => {
    setQuery((prev) => ({...prev, page: nextPage}));
  };

  const handleCopyCode = (inviteId: number, code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedInviteId(inviteId);
      if (copyResetTimerRef.current !== null) {
        window.clearTimeout(copyResetTimerRef.current);
      }
      copyResetTimerRef.current = window.setTimeout(() => {
        setCopiedInviteId(null);
      }, 1500);
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">注册邀请码</h1>
          <p className="text-sm text-zinc-500 mt-1">管理用户注册使用的邀请码，不复用项目协作邀请码。</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
        <Card title="筛选条件">
          <form className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3" onSubmit={submitSearch}>
            <label>
              <span className="block text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wider">状态 status</span>
              <select
                value={draftStatus}
                onChange={(event) => setDraftStatus(event.target.value as '' | AdminRegisterInviteStatus)}
                className="w-full px-3 py-2 bg-white border border-black/5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/5"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.label} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <Button type="submit" isLoading={listQuery.isFetching}>查询邀请码</Button>
            </div>
          </form>
        </Card>

        <Card title="创建邀请码">
          <form className="space-y-3" onSubmit={handleCreate}>
            <label>
              <span className="block text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wider">自定义 code</span>
              <input
                type="text"
                value={draftCode}
                onChange={(event) => setDraftCode(event.target.value.toUpperCase())}
                placeholder="留空则系统自动生成"
                className="w-full px-3 py-2 bg-white border border-black/5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/5 font-mono uppercase tracking-[0.2em]"
              />
            </label>
            <label>
              <span className="block text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wider">批量数量 count</span>
              <input
                type="number"
                min={1}
                max={100}
                value={draftCount}
                onChange={(event) => setDraftCount(event.target.value)}
                className="w-full px-3 py-2 bg-white border border-black/5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/5"
              />
            </label>
            <p className="text-xs text-zinc-500">
              数量大于 1 时将忽略自定义 `code`，由服务端自动批量生成。
            </p>
            {createError ? <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">{createError}</div> : null}
            <Button type="submit" isLoading={createMutation.isPending}>批量创建注册邀请码</Button>
          </form>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="邀请码列表" extra={listQuery.pageData ? <Badge variant="info">{listQuery.pageData.total} 条</Badge> : null}>
          {listError ? <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">{listError}</div> : null}
          {listQuery.isLoading ? <p className="text-sm text-zinc-500">正在加载列表...</p> : null}

          {listQuery.pageData?.items.length ? (
            <div className="space-y-3">
              {listQuery.pageData.items.map((item) => (
                <div key={item.inviteId} className="rounded-lg border border-black/5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedInviteId(item.inviteId)}
                      className="flex min-w-0 items-center gap-2 text-left"
                    >
                      <p className="min-w-0 truncate text-sm text-zinc-900 font-mono tracking-[0.2em]">{item.code}</p>
                    </button>
                    <div className="flex items-center gap-2">
                      <CopyCodeButton
                        inviteId={item.inviteId}
                        code={item.code}
                        copied={copiedInviteId === item.inviteId}
                        onCopy={handleCopyCode}
                      />
                      <Badge variant={item.status === 'USED' ? 'warning' : item.status === 'INACTIVE' ? 'neutral' : 'success'}>
                        {item.status}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-500 mt-2">inviteId: {item.inviteId}</p>
                  <p className="text-xs text-zinc-500 mt-1">createdBy: {item.createdBy ?? '-'}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      variant="outline"
                      disabled={item.status !== 'ACTIVE' || deactivateMutation.isPending}
                      onClick={() => deactivateMutation.mutate(item.inviteId)}
                    >
                      停用
                    </Button>
                    <Button
                      variant="danger"
                      disabled={item.status === 'USED' || deleteMutation.isPending}
                      onClick={() =>
                        deleteMutation.mutate(item.inviteId, {
                          onSuccess: () => {
                            if (selectedInviteId === item.inviteId) {
                              setSelectedInviteId(undefined);
                            }
                          },
                        })
                      }
                    >
                      删除
                    </Button>
                  </div>
                </div>
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
          extra={selectedInviteId !== undefined ? <span className="text-xs text-zinc-500 font-mono">{selectedInviteId}</span> : <Ticket size={14} className="text-zinc-400" />}
        >
          {selectedInviteId === undefined ? <p className="text-sm text-zinc-500">点击左侧列表项查看详情。</p> : null}
          {detailError ? <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">{detailError}</div> : null}
          {detailQuery.detail ? (
            <div className="space-y-2 text-sm text-zinc-900">
              <DetailRow label="inviteId" value={String(detailQuery.detail.inviteId)} mono />
              <DetailRow
                label="code"
                value={detailQuery.detail.code}
                mono
                extra={
                  <CopyCodeButton
                    inviteId={detailQuery.detail.inviteId}
                    code={detailQuery.detail.code}
                    copied={copiedInviteId === detailQuery.detail.inviteId}
                    onCopy={handleCopyCode}
                  />
                }
              />
              <DetailRow label="status" value={detailQuery.detail.status} />
              <DetailRow label="createdBy" value={detailQuery.detail.createdBy ? String(detailQuery.detail.createdBy) : '-'} />
              <DetailRow label="usedByUserId" value={detailQuery.detail.usedByUserId ? String(detailQuery.detail.usedByUserId) : '-'} />
              <DetailRow label="usedAt" value={formatDateTime(detailQuery.detail.usedAt)} />
              <DetailRow label="createdAt" value={formatDateTime(detailQuery.detail.createdAt)} />
              <DetailRow label="updatedAt" value={formatDateTime(detailQuery.detail.updatedAt)} />
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
};

const DetailRow: React.FC<{label: string; value: string; mono?: boolean; extra?: React.ReactNode}> = ({label, value, mono, extra}) => (
  <div className="flex items-start justify-between gap-2">
    <p className="text-xs text-zinc-500 uppercase tracking-wider">{label}</p>
    <div className="flex items-center gap-2">
      <p className={`text-sm text-zinc-900 ${mono ? 'font-mono' : ''}`}>{value}</p>
      {extra}
    </div>
  </div>
);

const CopyCodeButton: React.FC<{
  inviteId: number;
  code: string;
  copied: boolean;
  onCopy: (inviteId: number, code: string) => void;
}> = ({inviteId, code, copied, onCopy}) => (
  <Button
    type="button"
    variant="ghost"
    size="sm"
    className="h-7 px-2 text-[11px] gap-1"
    onClick={() => onCopy(inviteId, code)}
  >
    {copied ? <Check size={12} /> : <Copy size={12} />}
    {copied ? '已复制' : '复制'}
  </Button>
);

const formatDateTime = (value: string | null | undefined) => {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('zh-CN', {hour12: false});
};
