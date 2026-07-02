// ProjectDetailSidebar 负责展示项目详情页的成员与状态侧栏。
import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useProjectMembers } from '../../../features/members';
import { useRemoveProjectMember } from '../../../features/members';
import { useLeaveProject } from '../../../features/members';
import { useTransferProjectOwner } from '../../../features/members';
import { useUpdateProjectMemberRole } from '../../../features/members';
import { useCreateProjectInvite } from '../../../features/invite';
import { useCurrentUser } from '../../../../auth';
import type { ProjectMember } from '../../../entities';
import { Modal } from '@leary/ui';
import { ConfirmDialog } from '@leary/ui';
import { resolveApiErrorMessage } from '@/shared/api/resolveApiError';
import { useAppDispatch } from '@/app/store/hooks';
import { openDialog } from '@/app/store/ui/dialogSlice';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';
import { resolveProjectDetailBackTarget } from '@/modules/resource';
import { TourStep } from '@leary/tour-guide';

interface ProjectDetailSidebarProps {
  projectId: string;
  guideTag?: string;
  mobileSummaryMode?: 'stacked' | 'inline' | 'hidden';
  desktopPanelVisible?: boolean;
}

const DEFAULT_PAGE_SIZE = 50;

const MEMBER_BADGE_CLASSNAME: Record<string, string> = {
  OWNER: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600',
  ADMIN: 'bg-primary/10 text-primary',
  MEMBER: 'bg-sky-100 dark:bg-sky-900/30 text-sky-600',
};

const ProjectDetailSidebar: React.FC<ProjectDetailSidebarProps> = ({
  projectId,
  guideTag,
  mobileSummaryMode = 'stacked',
  desktopPanelVisible = true,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const currentUser = useCurrentUser();
  const [page] = useState(1);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showMobileManageModal, setShowMobileManageModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<ProjectMember | null>(null);
  const [roleTarget, setRoleTarget] = useState<ProjectMember | null>(null);
  const [roleValue, setRoleValue] = useState<'ADMIN' | 'MEMBER'>('MEMBER');
  const [transferTargetId, setTransferTargetId] = useState<number | null>(null);
  const [inviteResult, setInviteResult] = useState<{ code: string; expiresAt: string } | null>(null);
  const [inviteMaxUse, setInviteMaxUse] = useState(3);
  const [inviteExpiresAt, setInviteExpiresAt] = useState('');
  const listQuery = useProjectMembers(projectId, page, DEFAULT_PAGE_SIZE);
  const removeMemberMutation = useRemoveProjectMember();
  const leaveProjectMutation = useLeaveProject();
  const transferOwnerMutation = useTransferProjectOwner();
  const updateRoleMutation = useUpdateProjectMemberRole();
  const createInviteMutation = useCreateProjectInvite();

  const members = useMemo(() => listQuery.data?.items ?? [], [listQuery.data?.items]);
  const currentMember = useMemo(
    () => members.find((member) => member.userId === currentUser?.id),
    [currentUser?.id, members]
  );
  const isOwner = currentMember?.role === 'OWNER';
  const canInvite = currentMember?.role === 'OWNER' || currentMember?.role === 'ADMIN';
  const transferCandidates = members.filter(
    (member) => member.userId !== currentUser?.id && member.role !== 'OWNER'
  );
  const inviteFormReady = inviteMaxUse >= 1 && inviteExpiresAt.trim().length > 0;
  const inviteExpiresAtLabel = inviteExpiresAt
    ? new Date(inviteExpiresAt).toLocaleString('zh-CN')
    : '';
  const visibleSummaryMembers = members.slice(0, 3);
  const mobileSummaryCardClassName = mobileSummaryMode === 'inline'
    ? 'rounded-2xl border border-slate-200 bg-white px-2.5 py-2 shadow-sm dark:border-[#2a2a2a] dark:bg-[#1a1a1a] lg:hidden'
    : 'rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2a2a2a] dark:bg-[#1a1a1a] lg:hidden';

  const memberPanel = (
    <div className="bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] rounded-3xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-sm flex items-center gap-2 text-slate-900 dark:text-white uppercase tracking-wider">
          <MaterialIcon name="diversity_3" className="text-primary text-[20px]" />
          项目成员
        </h3>
        <div className="flex -space-x-2 overflow-hidden">
          {members.length > 3 ? (
            <div className="flex items-center justify-center h-6 w-6 rounded-full ring-2 ring-white dark:ring-[#121212] bg-slate-800 text-[8px] font-bold text-white">
              +{members.length - 3}
            </div>
          ) : null}
        </div>
      </div>

      <div className="space-y-1 mb-6 max-h-80 overflow-y-auto custom-scrollbar pr-1">
        {listQuery.isLoading ? (
          <div className="py-6 text-center text-xs text-slate-400">成员加载中...</div>
        ) : listQuery.isError ? (
          <div className="py-6 text-center text-xs text-rose-500">
            {resolveApiErrorMessage(listQuery.error, '成员加载失败')}
          </div>
        ) : members.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">暂无成员</div>
        ) : (
          members.map((member) => {
            const displayName = member.name?.trim() || `用户 ${member.userId}`;
            const initial = displayName.slice(0, 1).toUpperCase();
            return (
              <div
                key={member.userId}
                className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-[#202020] group transition-all hover:shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold ${MEMBER_BADGE_CLASSNAME[member.role] ?? MEMBER_BADGE_CLASSNAME.MEMBER}`}
                    >
                      {initial}
                    </div>
                    <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-slate-100 dark:border-[#121212] rounded-full"></span>
                  </div>
                  <div>
                    <div className="text-[13px] font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      {displayName}
                      {member.userId === currentUser?.id ? (
                        <span className="text-[10px] text-primary font-bold">我</span>
                      ) : null}
                      {member.role === 'OWNER' ? (
                        <MaterialIcon name="verified" className="text-[14px] text-amber-500" />
                      ) : null}
                    </div>
                    <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">
                      {member.role}
                    </div>
                  </div>
                </div>
                {isOwner && member.role !== 'OWNER' ? (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button
                      onClick={() => {
                        setRoleTarget(member);
                        setRoleValue(member.role === 'ADMIN' ? 'ADMIN' : 'MEMBER');
                        setShowRoleModal(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-slate-700 transition-all"
                      title="修改权限"
                      disabled={updateRoleMutation.isPending}
                    >
                      <MaterialIcon name="manage_accounts" className="text-[18px]" />
                    </button>
                    <button
                      onClick={() => setRemoveTarget(member)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 transition-all"
                      title="移出项目"
                      disabled={removeMemberMutation.isPending}
                    >
                      <MaterialIcon name="person_remove" className="text-[18px]" />
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <button
        type="button"
        className="w-full bg-primary text-white py-3 rounded-2xl text-xs font-bold hover:bg-opacity-90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={!canInvite || createInviteMutation.isPending}
        onClick={() => {
          if (!canInvite) {
            return;
          }
          const defaultExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
          setInviteMaxUse(3);
          setInviteExpiresAt(defaultExpiresAt.toISOString().slice(0, 16));
          setShowInviteModal(true);
        }}
      >
        <MaterialIcon name="person_add" className="text-[18px]" />
        邀请新成员
      </button>
      <button
        type="button"
        className="mt-3 w-full flex items-center gap-3 px-4 py-3 text-rose-500/80 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 rounded-2xl transition-all text-[13px] font-bold group"
        disabled={!currentMember}
        onClick={() => {
          if (isOwner) {
            if (transferCandidates.length === 0) {
              dispatch(
                openDialog({
                  type: 'notice',
                  payload: {
                    title: '提示',
                    message: '暂无可移交的成员，请先邀请成员加入项目。',
                  },
                })
              );
              return;
            }
            setShowTransferModal(true);
            setTransferTargetId(transferCandidates[0]?.userId ?? null);
          } else {
            setShowLeaveConfirm(true);
          }
        }}
      >
        <MaterialIcon name="logout" className="text-[20px] group-hover:rotate-12 transition-transform" />
        {isOwner ? '移交当前项目' : '退出当前项目'}
      </button>
    </div>
  );

  return (
    <aside className="col-span-12 lg:col-span-4">
      <div className="sticky top-28 space-y-6">
        {mobileSummaryMode !== 'hidden' ? (
          <div className={mobileSummaryCardClassName}>
            <div className={`flex items-center justify-between gap-3 ${mobileSummaryMode === 'inline' ? 'min-w-[156px] max-w-[52vw]' : 'gap-4'}`}>
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex -space-x-2 overflow-hidden">
                  {visibleSummaryMembers.map((member) => {
                    const displayName = member.name?.trim() || `用户 ${member.userId}`;
                    const initial = displayName.slice(0, 1).toUpperCase();
                    return (
                      <div
                        key={`summary-${member.userId}`}
                        className={`flex ${mobileSummaryMode === 'inline' ? 'h-7 w-7 text-[10px]' : 'h-8 w-8 text-[11px]'} items-center justify-center rounded-full ring-2 ring-white font-bold dark:ring-[#121212] ${MEMBER_BADGE_CLASSNAME[member.role] ?? MEMBER_BADGE_CLASSNAME.MEMBER}`}
                      >
                        {initial}
                      </div>
                    );
                  })}
                </div>
                <div className="min-w-0">
                  <p className={`${mobileSummaryMode === 'inline' ? 'text-[13px]' : 'text-sm'} truncate font-semibold text-slate-900 dark:text-white`}>
                    {members.length}位成员
                  </p>
                  {mobileSummaryMode === 'stacked' ? (
                    <p className="text-xs text-slate-400">
                      点击管理查看完整成员信息
                    </p>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileManageModal(true)}
                className={`inline-flex shrink-0 items-center gap-1 rounded-xl ${mobileSummaryMode === 'inline' ? 'px-1.5 py-1.5 text-[13px]' : 'px-2 py-2 text-sm'} font-semibold text-primary transition-colors hover:bg-primary/10`}
              >
                <span>管理</span>
                <MaterialIcon name="chevron_right" className="text-base" />
              </button>
            </div>
          </div>
        ) : null}
        {desktopPanelVisible ? (
          guideTag ? (
            <TourStep
              tag={guideTag}
              order={1}
              title="成员权限"
              content="这里可以管理成员权限。"
            >
              <div className="hidden lg:block">
                {memberPanel}
              </div>
            </TourStep>
          ) : (
            <div className="hidden lg:block">
              {memberPanel}
            </div>
          )
        ) : null}
      </div>

      <Modal
        isOpen={showMobileManageModal}
        title="项目成员管理"
        onClose={() => setShowMobileManageModal(false)}
      >
        <div className="-m-2">
          {memberPanel}
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(inviteResult)}
        title="邀请码已创建"
        onClose={() => setInviteResult(null)}
      >
        {inviteResult ? (
          <div className="space-y-4">
            <div className="bg-slate-50 dark:bg-[#121212] rounded-2xl p-4 border border-slate-200 dark:border-[#2a2a2a]">
              <p className="text-xs text-slate-400 mb-2">邀请码</p>
              <p className="text-lg font-black text-slate-900 dark:text-white tracking-wider">
                {inviteResult.code}
              </p>
            </div>
            <p className="text-xs text-slate-500">
              有效期至：{new Date(inviteResult.expiresAt).toLocaleString('zh-CN')}
            </p>
          </div>
        ) : null}
      </Modal>

      <Modal isOpen={showInviteModal} title="创建邀请码" onClose={() => setShowInviteModal(false)}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2">最大邀请人数</label>
            <input
              type="number"
              min={1}
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-accent"
              value={inviteMaxUse}
              onChange={(event) => setInviteMaxUse(Math.max(1, Number(event.target.value)))}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2">过期时间</label>
            <input
              type="datetime-local"
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-accent"
              value={inviteExpiresAt}
              onChange={(event) => setInviteExpiresAt(event.target.value)}
            />
            {inviteExpiresAtLabel ? (
              <p className="text-[11px] text-slate-400 mt-2">当前：{inviteExpiresAtLabel}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="w-full rounded-2xl bg-primary text-white text-sm font-semibold py-3 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-primary/20 transition-all"
            disabled={!inviteFormReady || createInviteMutation.isPending}
            onClick={async () => {
              if (!inviteFormReady) return;
              const expiresAtIso = new Date(inviteExpiresAt).toISOString();
              try {
                const result = await createInviteMutation.mutateAsync({
                  projectId,
                  maxUse: inviteMaxUse,
                  expiresAt: expiresAtIso,
                });
                setShowInviteModal(false);
                setInviteResult({ code: result.code, expiresAt: result.expiresAt });
              } catch (error) {
                const message = resolveApiErrorMessage(error, '邀请创建失败，请稍后再试');
                dispatch(
                  openDialog({
                    type: 'error',
                    payload: {
                      title: '出错了',
                      message,
                    },
                  })
                );
              }
            }}
          >
            创建邀请码
          </button>
        </div>
      </Modal>

      <Modal isOpen={showTransferModal} title="移交项目" onClose={() => setShowTransferModal(false)}>
        <div className="space-y-4">
          <p className="text-xs text-slate-500">请选择新的项目负责人，移交后您将变为管理员。</p>
          <select
            className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-accent"
            value={transferTargetId ?? ''}
            onChange={(event) => setTransferTargetId(Number(event.target.value))}
          >
            {transferCandidates.map((member) => {
              const displayName = member.name?.trim() || `用户 ${member.userId}`;
              return (
                <option key={member.userId} value={member.userId}>
                  {displayName}
                </option>
              );
            })}
          </select>
          <button
            type="button"
            className="w-full rounded-2xl bg-primary text-white text-sm font-semibold py-3 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-primary/20 transition-all"
            disabled={!transferTargetId || transferOwnerMutation.isPending}
            onClick={async () => {
              if (!transferTargetId) return;
              try {
                await transferOwnerMutation.mutateAsync({ projectId, targetUserId: transferTargetId });
                setShowTransferModal(false);
                dispatch(
                  openDialog({
                    type: 'notice',
                    payload: {
                      title: '提示',
                      message: '移交成功',
                    },
                  })
                );
              } catch (error) {
                const message = resolveApiErrorMessage(error, '移交失败，请稍后再试');
                dispatch(
                  openDialog({
                    type: 'error',
                    payload: {
                      title: '出错了',
                      message,
                    },
                  })
                );
              }
            }}
          >
            确认移交
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={showRoleModal}
        title="修改成员权限"
        onClose={() => {
          setShowRoleModal(false);
          setRoleTarget(null);
        }}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            {roleTarget?.name?.trim() || (roleTarget ? `用户 ${roleTarget.userId}` : '')}
          </p>
          <select
            className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-accent"
            value={roleValue}
            onChange={(event) => setRoleValue(event.target.value as 'ADMIN' | 'MEMBER')}
          >
            <option value="ADMIN">管理员</option>
            <option value="MEMBER">成员</option>
          </select>
          <button
            type="button"
            className="w-full rounded-2xl bg-primary text-white text-sm font-semibold py-3 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-primary/20 transition-all"
            disabled={!roleTarget || updateRoleMutation.isPending}
            onClick={async () => {
              if (!roleTarget) return;
              try {
                await updateRoleMutation.mutateAsync({
                  projectId,
                  userId: roleTarget.userId,
                  role: roleValue,
                });
                setShowRoleModal(false);
                setRoleTarget(null);
                dispatch(
                  openDialog({
                    type: 'notice',
                    payload: {
                      title: '提示',
                      message: '权限已更新',
                    },
                  })
                );
              } catch (error) {
                const message = resolveApiErrorMessage(error, '权限更新失败，请稍后再试');
                dispatch(
                  openDialog({
                    type: 'error',
                    payload: {
                      title: '出错了',
                      message,
                    },
                  })
                );
              }
            }}
          >
            确认修改
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={showLeaveConfirm}
        title="退出项目"
        message="确认退出当前项目？退出后需重新邀请才能加入。"
        confirmText="退出"
        onConfirm={async () => {
          try {
            await leaveProjectMutation.mutateAsync({ projectId });
            setShowLeaveConfirm(false);
            navigate(resolveProjectDetailBackTarget(location.state), { replace: true });
          } catch (error) {
            const message = resolveApiErrorMessage(error, '退出失败，请稍后再试');
            dispatch(
              openDialog({
                type: 'error',
                payload: {
                  title: '出错了',
                  message,
                },
              })
            );
          }
        }}
        onCancel={() => setShowLeaveConfirm(false)}
      />
      <ConfirmDialog
        isOpen={Boolean(removeTarget)}
        title="移除成员"
        message={
          removeTarget
            ? `确认移除「${removeTarget.name?.trim() || `用户 ${removeTarget.userId}`}」？`
            : '确认移除该成员？'
        }
        confirmText="移除"
        onConfirm={async () => {
          if (!removeTarget || removeMemberMutation.isPending) {
            return;
          }
          try {
            await removeMemberMutation.mutateAsync({ projectId, userId: removeTarget.userId });
            setRemoveTarget(null);
            dispatch(
              openDialog({
                type: 'notice',
                payload: {
                  title: '提示',
                  message: '移除成功',
                },
              })
            );
          } catch (error) {
            const message = resolveApiErrorMessage(error, '移除失败，请稍后再试');
            dispatch(
              openDialog({
                type: 'error',
                payload: {
                  title: '出错了',
                  message,
                },
              })
            );
          }
        }}
        onCancel={() => setRemoveTarget(null)}
      />
    </aside>
  );
};

export default ProjectDetailSidebar;
