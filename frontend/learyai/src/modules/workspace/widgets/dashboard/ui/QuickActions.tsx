// QuickActions 负责呈现常用快捷操作卡片列表。
import React from 'react';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';
import type { QuickAction } from '@/shared/types';
import { TourStep } from '@leary/tour-guide';

const WORKSPACE_TOUR_TAG = 'workspace-quick-start-v1';

const actions: QuickAction[] = [
  {
    id: 'new-knowledge-base',
    title: '新建知识库',
    description: '根据自定义参数初始化全新知识库。',
    icon: 'book_4',
    colorClass: 'text-accent',
    bgColorClass: 'bg-accent/10 hover:bg-accent group-hover:bg-accent',
  },
  {
    id: 'create-project',
    title: '新建空间',
    description: '用邀请码加入或直接创建团队或个人项目空间。',
    icon: 'create_new_folder',
    colorClass: 'text-indigo-600',
    bgColorClass: 'bg-indigo-50 dark:bg-indigo-900/20 group-hover:bg-indigo-600',
  },
  {
    id: 'placeholder',
    title: '更多能力',
    description: '预留一个快捷入口占位，后续按需接入新能力。',
    icon: 'deployed_code',
    colorClass: 'text-rose-600',
    bgColorClass: 'bg-rose-50 dark:bg-rose-900/20 group-hover:bg-rose-600',
  },
  {
    id: 'usage-guide',
    title: '使用说明',
    description: '',
    icon: 'help',
    colorClass: 'text-slate-400',
    bgColorClass: 'bg-slate-100 dark:bg-[#242424] group-hover:bg-slate-200 dark:group-hover:bg-[#303030]',
  },
];

const ActionCard: React.FC<{ action: QuickAction; onClick?: () => void; disabled?: boolean }> = ({
  action,
  onClick,
  disabled = false,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="group flex flex-col items-start p-6 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] rounded-2xl hover:border-accent transition-all hover:shadow-xl hover:shadow-accent/5 w-full disabled:cursor-not-allowed disabled:opacity-60"
  >
    <div
      className={`w-12 h-12 ${action.bgColorClass} rounded-xl flex items-center justify-center mb-4 ${action.colorClass} group-hover:text-white transition-colors`}
    >
      <MaterialIcon name={action.icon} />
    </div>
    <h4 className="font-bold text-lg mb-1">{action.title}</h4>
    <p className="text-sm text-slate-500 text-left">{action.description}</p>
  </button>
);

const CompactActionCard: React.FC<{ action: QuickAction; onClick?: () => void; disabled?: boolean }> = ({
  action,
  onClick,
  disabled = false,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="group flex w-[6.75rem] shrink-0 flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-4 text-center transition-all hover:border-accent dark:border-[#2a2a2a] dark:bg-[#1a1a1a] disabled:cursor-not-allowed disabled:opacity-60"
  >
    <div
      className={`flex h-12 w-12 items-center justify-center rounded-2xl ${action.bgColorClass} ${action.colorClass} transition-colors group-hover:text-white`}
    >
      <MaterialIcon name={action.icon} />
    </div>
    <span className="text-sm font-bold leading-6 text-slate-700 dark:text-slate-100">
      {action.title}
    </span>
  </button>
);

const UsageGuideCard: React.FC<{ compact?: boolean }> = ({ compact = false }) => (
  <div
    className={
      compact
        ? 'flex w-[6.75rem] shrink-0 flex-col justify-between rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-4 text-center dark:border-[#2a2a2a] dark:bg-[#1a1a1a]'
        : 'flex min-h-[11rem] flex-col justify-between rounded-2xl border border-dashed border-slate-200 bg-white p-6 dark:border-[#2a2a2a] dark:bg-[#1a1a1a]'
    }
  >
    <div className={compact ? 'flex items-center justify-center' : 'flex items-start justify-between'}>
      <div className={`flex ${compact ? 'h-12 w-12' : 'h-12 w-12'} items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-[#242424]`}>
        <MaterialIcon name="help" />
      </div>
    </div>
    <div className={compact ? 'mt-2' : 'mt-6'}>
      <h4 className={compact ? 'text-sm font-bold leading-6 text-slate-700 dark:text-slate-100' : 'mb-1 text-lg font-bold text-slate-900 dark:text-white'}>
        使用说明
      </h4>
      {!compact ? <div className="h-12" /> : null}
    </div>
  </div>
);

interface QuickActionsProps {
  onCreateKnowledgeBase: () => void;
  onCreateProject: () => void;
  onPlaceholderAction: () => void;
}

const QuickActions: React.FC<QuickActionsProps> = ({
  onCreateKnowledgeBase,
  onCreateProject,
  onPlaceholderAction,
}) => {
  const handleAction = (actionId: string) => {
    if (actionId === 'new-knowledge-base') {
      onCreateKnowledgeBase();
    }
    if (actionId === 'create-project') {
      onCreateProject();
    }
    if (actionId === 'placeholder') {
      onPlaceholderAction();
    }
  };

  const renderAction = (action: QuickAction, compact = false) => {
    if (action.id === 'usage-guide') {
      return (
        <div key={`${compact ? 'compact' : 'card'}-${action.id}`}>
          <UsageGuideCard compact={compact} />
        </div>
      );
    }
    const card = compact
      ? <CompactActionCard action={action} onClick={() => handleAction(action.id)} />
      : <ActionCard action={action} onClick={() => handleAction(action.id)} />;
    if (action.id === 'new-knowledge-base') {
      return (
        <TourStep
          key={`${compact ? 'compact' : 'card'}-${action.id}`}
          tag={WORKSPACE_TOUR_TAG}
          order={1}
          title="新建知识库"
          content="这里可以快速新建知识库，进入知识库后上传文档即可开始使用"
        >
          {card}
        </TourStep>
      );
    }
    if (action.id === 'create-project') {
      return (
        <TourStep
          key={`${compact ? 'compact' : 'card'}-${action.id}`}
          tag={WORKSPACE_TOUR_TAG}
          order={2}
          title="空间"
          content="这里可以快速新建空间，空间用于管理不同知识库的成员及相关权限。"
        >
          {card}
        </TourStep>
      );
    }
    if (action.id === 'placeholder') {
      return React.cloneElement(card, { key: `${compact ? 'compact' : 'card'}-${action.id}` });
    }
    return React.cloneElement(card, { key: `${compact ? 'compact' : 'card'}-${action.id}` });
  };

  return (
    <section className="mt-2">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">快捷操作</h3>
      </div>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden dark:text-white md:hidden">
        {actions.map((action) => renderAction(action, true))}
      </div>
      <div className="hidden grid-cols-1 gap-6 dark:text-white sm:grid-cols-2 lg:grid-cols-4 md:grid">
        {actions.map((action) => renderAction(action))}
      </div>
    </section>
  );
};

export default QuickActions;
