// ResourceDetailHeader 负责渲染资源详情页头部信息、名称就地编辑入口与动作区。
import React from 'react';
import { EditableText } from '@leary/text-editable';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';
import type { ResourceDetail } from '../../../entities/resource';
import type { ResourceTextEditAnchor } from '../lib/resourceTextEdit';

interface ResourceDetailHeaderProps {
  canOpenVideoDetail: boolean;
  headerActions?: React.ReactNode;
  onRequestTextEdit: (payload: {
    title: string;
    value: string;
    anchor: ResourceTextEditAnchor;
    multiline?: boolean;
  }) => void;
  onOpenVideoDetailTab?: (docId: string, label: string) => void;
  resource: ResourceDetail;
  resourceMeta: string;
}

const ResourceDetailHeader: React.FC<ResourceDetailHeaderProps> = ({
  canOpenVideoDetail,
  headerActions,
  onRequestTextEdit,
  onOpenVideoDetailTab,
  resource,
  resourceMeta,
}) => (
  <div className="mb-8 rounded-[1.25rem] bg-transparent dark:bg-transparent">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-[#2a2a2a]">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 dark:border-[#2a2a2a] dark:bg-[#121212] dark:text-slate-300">
          <MaterialIcon name="description" className="text-[18px]" />
        </span>
        <div className="min-w-0">
          <EditableText
            title="资源名称"
            value={resource.name}
            anchor={{ kind: 'name' }}
            className="w-full max-w-full"
            contentClassName="min-w-0 flex-1"
            triggerClassName="mt-1"
            triggerPlacement="inline"
            onRequestEdit={onRequestTextEdit}
          >
            <h1 className="truncate text-[28px] font-semibold tracking-tight text-slate-900 dark:text-white">
              {resource.name}
            </h1>
          </EditableText>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {headerActions}
        {canOpenVideoDetail ? (
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-[#17305c] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#102548]"
            onClick={() => onOpenVideoDetailTab?.(resource.docId, `${resource.name} · 视频`)}
          >
            <MaterialIcon name="smart_display" className="text-base" />
            <span>查看视频</span>
          </button>
        ) : null}
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-3 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-[#a0a0a0]">
      <span className="flex items-center gap-1.5"><MaterialIcon name="calendar_today" className="text-sm" /> {resourceMeta}</span>
      <span className="hidden sm:inline">•</span>
      <span className="flex items-center gap-1.5"><MaterialIcon name="label" className="text-sm" /> {resource.fileType.toUpperCase()}</span>
    </div>
  </div>
);

export default ResourceDetailHeader;
