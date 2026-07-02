// 责任：展示并更新管理员选中用户的会员周期与额度配置。
import React, {useEffect, useState} from 'react';
import {Clock3, Save, ShieldCheck} from 'lucide-react';
import {Card} from '@/shared/components/Card';
import {Badge} from '@/shared/components/Badge';
import {Button} from '@/shared/components/Button';
import {useUpdateUserSubscriptionCycle, useUserSubscriptionCycles} from '@/modules/user/hooks/useUser';
import type {AdminUserRecentLoginItemResponse} from '@/shared/types/api';
import type {ApiClientError} from '@/shared/api/client';

const DEFAULT_METRICS = ['ai_chat_tokens', 'kbdoc_size', 'template_generate_count'] as const;

interface UserSubscriptionCyclePanelProps {
  selectedUser: AdminUserRecentLoginItemResponse | null;
}

export const UserSubscriptionCyclePanel: React.FC<UserSubscriptionCyclePanelProps> = ({selectedUser}) => {
  const [metric, setMetric] = useState<string>(DEFAULT_METRICS[0]);
  const [planId, setPlanId] = useState('manual-admin');
  const [quota, setQuota] = useState('0');
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedUserId = selectedUser?.userId ?? null;
  const cycleQuery = useUserSubscriptionCycles(selectedUserId);
  const updateMutation = useUpdateUserSubscriptionCycle(selectedUserId);
  const mutationError = updateMutation.error as ApiClientError | null;

  useEffect(() => {
    if (!selectedUser) {
      return;
    }
    const matchingCycle = cycleQuery.cycles.find((item) => item.metric === metric && item.status === 'ACTIVE');
    if (matchingCycle) {
      setPlanId(matchingCycle.planId);
      setQuota(String(matchingCycle.quota));
      setValidFrom(toDatetimeLocalValue(matchingCycle.validFrom));
      setValidTo(toDatetimeLocalValue(matchingCycle.validTo));
      return;
    }
    const now = new Date();
    const nextMonth = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
    setPlanId('manual-admin');
    setQuota('0');
    setValidFrom(toDatetimeLocalValue(now.toISOString()));
    setValidTo(toDatetimeLocalValue(nextMonth.toISOString()));
  }, [selectedUser, cycleQuery.cycles, metric]);

  useEffect(() => {
    setSubmitMessage(null);
    setFormError(null);
  }, [selectedUserId, metric]);

  if (!selectedUser) {
    return (
      <Card title="会员周期与额度">
        <p className="text-sm text-zinc-500">从左侧最近登录用户列表中选择一个用户后，可查看并更新该用户的会员周期和用量限制。</p>
      </Card>
    );
  }

  const activeCycle = cycleQuery.cycles.find((item) => item.metric === metric && item.status === 'ACTIVE');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedUserId) {
      return;
    }
    setSubmitMessage(null);
    setFormError(null);
    const normalizedPlanId = planId.trim();
    if (!normalizedPlanId) {
      setFormError('Plan ID 不能为空');
      return;
    }
    const normalizedQuota = Number(quota);
    if (!Number.isFinite(normalizedQuota) || normalizedQuota < 0) {
      setFormError('Quota 必须是大于等于 0 的数字');
      return;
    }
    const normalizedValidFrom = toIsoDateTime(validFrom);
    if (!normalizedValidFrom) {
      setFormError('Valid From 不能为空，且必须是合法时间');
      return;
    }
    const normalizedValidTo = toIsoDateTime(validTo);
    if (!normalizedValidTo) {
      setFormError('Valid To 不能为空，且必须是合法时间');
      return;
    }
    if (new Date(normalizedValidTo).getTime() <= new Date(normalizedValidFrom).getTime()) {
      setFormError('Valid To 必须晚于 Valid From');
      return;
    }
    await updateMutation.mutateAsync({
      metric,
      body: {
        planId: normalizedPlanId,
        quota: normalizedQuota,
        validFrom: normalizedValidFrom,
        validTo: normalizedValidTo,
      },
    });
    setSubmitMessage('会员周期与额度已更新');
  };

  return (
    <Card
      title="会员周期与额度"
      extra={<Badge variant="info">仅平台管理员可操作</Badge>}
      className="h-full"
    >
      <div className="space-y-6">
        <div className="rounded-xl border border-black/5 bg-zinc-50 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">选中用户</p>
              <p className="mt-2 text-lg font-semibold text-zinc-900">{selectedUser.name || `用户 ${selectedUser.userId}`}</p>
              <p className="mt-1 text-sm text-zinc-500">userId={selectedUser.userId} · {selectedUser.email || selectedUser.phone || '未记录联系方式'}</p>
            </div>
            <div className="rounded-xl bg-white px-3 py-2 text-right shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">模式</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">{selectedUser.userMode || '未记录'}</p>
            </div>
          </div>
        </div>

        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Metric</span>
            <select
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
              value={metric}
              onChange={(event) => setMetric(event.target.value)}
            >
              {DEFAULT_METRICS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Plan ID</span>
            <input
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
              value={planId}
              onChange={(event) => setPlanId(event.target.value)}
              placeholder="manual-admin"
              required
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Quota</span>
            <input
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
              type="number"
              min={0}
              value={quota}
              onChange={(event) => setQuota(event.target.value)}
              required
            />
          </label>

          <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldCheck size={16} />
              当前 Active 配置
            </div>
            <p className="mt-2 break-all">
              {activeCycle
                ? `${activeCycle.planId} · quota=${activeCycle.quota} · ${formatDateTime(activeCycle.validFrom)} - ${formatDateTime(activeCycle.validTo)}`
                : '该 metric 暂无 Active 配置'}
            </p>
          </div>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Valid From</span>
            <input
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
              type="datetime-local"
              value={validFrom}
              onChange={(event) => setValidFrom(event.target.value)}
              required
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Valid To</span>
            <input
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
              type="datetime-local"
              value={validTo}
              onChange={(event) => setValidTo(event.target.value)}
              required
            />
          </label>

          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            <Button type="submit" isLoading={updateMutation.isPending} className="gap-2">
              <Save size={14} />
              保存会员周期
            </Button>
            {submitMessage ? <span className="text-sm text-emerald-700">{submitMessage}</span> : null}
            {formError ? <span className="text-sm text-rose-700">{formError}</span> : null}
            {mutationError ? <span className="text-sm text-rose-700">{mutationError.message}</span> : null}
          </div>
        </form>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock3 size={16} className="text-zinc-500" />
            <h4 className="text-sm font-semibold text-zinc-900">该用户已有周期记录</h4>
          </div>
          {cycleQuery.isLoading ? <p className="text-sm text-zinc-500">正在加载会员周期...</p> : null}
          {!cycleQuery.isLoading && cycleQuery.cycles.length === 0 ? (
            <p className="text-sm text-zinc-500">暂无任何会员周期记录。</p>
          ) : null}
          {cycleQuery.cycles.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-black/5">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-left text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Metric</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Quota</th>
                    <th className="px-4 py-3">状态</th>
                    <th className="px-4 py-3">周期</th>
                  </tr>
                </thead>
                <tbody>
                  {cycleQuery.cycles.map((item) => (
                    <tr key={`${item.id ?? 'new'}-${item.metric}-${item.validFrom}`} className="border-t border-black/5">
                      <td className="px-4 py-3 font-mono text-xs text-zinc-700">{item.metric}</td>
                      <td className="px-4 py-3">{item.planId}</td>
                      <td className="px-4 py-3">{item.quota}</td>
                      <td className="px-4 py-3">
                        <Badge variant={item.status === 'ACTIVE' ? 'success' : 'neutral'}>{item.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {formatDateTime(item.validFrom)} - {formatDateTime(item.validTo)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('zh-CN', {hour12: false});
};

const toDatetimeLocalValue = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60_000);
  return localDate.toISOString().slice(0, 16);
};

const toIsoDateTime = (value: string) => {
  if (!value.trim()) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
};
