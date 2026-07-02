// ResourceGrid 负责渲染资源卡片列表。
import React from 'react';
import { formatUrlDisplayName } from '@/shared/lib/formatters';
import type { ResourceListItem } from '../../../entities/resource';
import DeleteResourceAction from '../../../features/delete-resource';
import MobileClickableCard from '@/shared/ui/MobileClickableCard';
import SharedLinkCard from '@/shared/ui/SharedLinkCard';
import ResponsiveCardCollection from '@/shared/ui/ResponsiveCardCollection';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';

interface ResourceGridProps {
  items: ResourceListItem[];
  onOpen: (docId: string) => void;
  projectId?: string;
  referencedDocIds?: string[];
  onToggleReference?: (item: ResourceListItem) => void;
  onResourceDeleted?: (docId: string) => void;
}

const resolveIcon = (fileType: string) => {
  switch (fileType) {
    case 'pdf':
      return 'picture_as_pdf';
    case 'docx':
      return 'description';
    case 'pptx':
      return 'slideshow';
    case 'md':
      return 'markdown';
    case 'url':
      return 'link';
    case 'wav':
    case 'mp3':
    case 'm4a':
    case 'aac':
    case 'flac':
    case 'ogg':
      return 'audio_file';
    default:
      return 'insert_drive_file';
  }
};

const formatSize = (size: number) => {
  if (size >= 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)}GB`;
  }
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)}MB`;
  }
  if (size >= 1024) {
    return `${Math.max(1, Math.round(size / 1024))}KB`;
  }
  return `${size}B`;
};

const formatCreatedAt = (value: string) => {
  const createdAt = new Date(value);
  if (Number.isNaN(createdAt.getTime())) return null;
  return createdAt.toLocaleDateString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
  });
};

const ResourceGrid: React.FC<ResourceGridProps> = ({
  items,
  onOpen,
  projectId,
  referencedDocIds = [],
  onToggleReference,
  onResourceDeleted,
}) => {
  return (
    <ResponsiveCardCollection
      items={items}
      getKey={(item) => item.docId}
      emptyState={(
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/60 p-10 text-center text-slate-400 dark:border-[#2a2a2a] dark:bg-[#1a1a1a]">
          <div className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400 dark:text-[#a0a0a0]">暂无资源</div>
          <p className="text-sm">可以通过右下角导入文件生成资源。</p>
        </div>
      )}
      renderMobileItem={(res) => {
          const isReferenceDisabled = res.status !== 'DONE';
          const isReferenced = !isReferenceDisabled && referencedDocIds.includes(res.docId);
          const referenceTitle = isReferenceDisabled ? '正在处理中' : undefined;
          const displayName = res.fileType === 'url' ? formatUrlDisplayName(res.name) : res.name;
          const createdAtLabel = formatCreatedAt(res.createdAt);
          const metaLabel = [createdAtLabel ? `添加于 ${createdAtLabel}` : null, formatSize(res.size)].filter(Boolean).join(' · ');
          const mobileReferenceButton = onToggleReference ? (
            <span title={referenceTitle} className="shrink-0">
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  if (isReferenceDisabled) return;
                  onToggleReference(res);
                }}
                disabled={isReferenceDisabled}
                className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black transition-all ${
                  isReferenced
                    ? 'border-primary/30 bg-primary/10 text-primary dark:bg-primary/20'
                    : isReferenceDisabled
                      ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-[#2a2a2a] dark:bg-[#121212] dark:text-[#a0a0a0]'
                      : 'border-slate-200 bg-slate-100 text-slate-500 dark:border-[#2a2a2a] dark:bg-[#171717] dark:text-[#d0d0d0]'
                }`}
              >
                {isReferenced ? '已引用' : '引用'}
              </button>
            </span>
          ) : null;

          return (
            <MobileClickableCard
              onClick={() => {
                if (isReferenceDisabled) return;
                onOpen(res.docId);
              }}
              disabled={isReferenceDisabled}
              className="relative"
            >
              <div className="absolute right-4 top-4 z-10 flex items-start gap-2">
                {mobileReferenceButton}
                <DeleteResourceAction
                  docId={res.docId}
                  projectId={projectId}
                  onDeleted={() => {
                    onResourceDeleted?.(res.docId);
                  }}
                  className="inline-flex size-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 shadow-sm transition-colors hover:border-rose-300 hover:text-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/60 dark:border-[#2a2a2a] dark:bg-[#171717]"
                />
              </div>
              <div className="flex items-start gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 ring-1 ring-slate-100 dark:bg-[#121212] dark:ring-[#2a2a2a]">
                  <MaterialIcon name={resolveIcon(res.fileType)} className="text-2xl" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 pr-24">
                      <h3 className="truncate text-base font-bold text-slate-800 dark:text-white" title={res.name}>
                        {displayName}
                      </h3>
                      <p className="mt-1 truncate text-xs text-slate-400">{metaLabel}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-[#2a2a2a]">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                      {res.fileType.toUpperCase()}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400">
                      {isReferenceDisabled ? '请等待处理完成' : '查看详情'}
                    </span>
                  </div>
                </div>
              </div>
            </MobileClickableCard>
          );
      }}
      renderDesktopItem={(res) => {
        const isReferenceDisabled = res.status !== 'DONE';
        const isReferenced = !isReferenceDisabled && referencedDocIds.includes(res.docId);
        const referenceTitle = isReferenceDisabled ? '正在处理中' : undefined;
        const displayName = res.fileType === 'url' ? formatUrlDisplayName(res.name) : res.name;
        return (
          <SharedLinkCard
            onClick={() => onOpen(res.docId)}
            disabled={isReferenceDisabled}
            disabledLabel="请等待处理完成"
            headerLeft={(
              <div className="size-11 rounded-xl bg-slate-50 dark:bg-[#121212] flex items-center justify-center text-slate-400 group-hover:bg-primary group-hover:text-white transition-all duration-500 ring-1 ring-slate-100 dark:ring-[#2a2a2a] group-hover:ring-primary shadow-sm">
                <MaterialIcon name={resolveIcon(res.fileType)} className="text-2xl" />
              </div>
            )}
            headerActions={(
              <>
                {onToggleReference ? (
                  <span title={referenceTitle}>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        if (isReferenceDisabled) return;
                        onToggleReference(res);
                      }}
                      disabled={isReferenceDisabled}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${
                        isReferenced
                          ? 'opacity-100 border-primary/30 bg-primary/10 text-primary dark:bg-primary/20'
                          : isReferenceDisabled
                            ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-[#121212] text-slate-400 dark:text-[#a0a0a0] border-slate-200 dark:border-[#2a2a2a]'
                            : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 bg-slate-100 dark:bg-[#121212] text-slate-500 dark:text-[#a0a0a0] border-slate-200 dark:border-[#2a2a2a] hover:border-primary/60'
                      }`}
                    >
                      <>
                        <MaterialIcon
                          name={isReferenced ? 'check' : 'add_circle'}
                          className="text-[12px]"
                        />
                        {isReferenced ? '已引用' : '引用'}
                      </>
                    </button>
                  </span>
                ) : null}
                <DeleteResourceAction
                  docId={res.docId}
                  projectId={projectId}
                  onDeleted={() => {
                    onResourceDeleted?.(res.docId);
                  }}
                  className="inline-flex items-center justify-center size-7 rounded-lg border border-transparent text-slate-400 transition-all opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 group-hover:border-slate-300 group-focus-within:border-slate-200 dark:group-hover:border-[#2a2a2a] dark:group-focus-within:border-[#2a2a2a] hover:border-rose-300 hover:text-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/60"
                />
              </>
            )}
            title={(
              <span className="block truncate" title={res.name}>
                {displayName}
              </span>
            )}
            footerLeft={(
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                {res.fileType.toUpperCase()}
              </span>
            )}
          />
        );
      }}
    />
  );
};

export default ResourceGrid;
