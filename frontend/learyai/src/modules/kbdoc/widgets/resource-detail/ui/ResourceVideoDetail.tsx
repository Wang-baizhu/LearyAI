// ResourceVideoDetail 负责展示 URL 资源对应的独立视频详情页。
import React from 'react';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import type { ResourceDetail as ResourceDetailType } from '../../../entities/resource';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';
import { resolveVideoEmbedConfig } from '../lib/video';
import { clearVideoJumpRequest } from '@/modules/resource';

interface ResourceVideoDetailProps {
  resource: ResourceDetailType;
  variant?: 'main' | 'sidebar';
}

const ResourceVideoDetail: React.FC<ResourceVideoDetailProps> = ({
  resource,
  variant = 'main',
}) => {
  const dispatch = useAppDispatch();
  const videoJumpRequest = useAppSelector((state) => state.resourceCenter.videoJumpRequest);
  const [startSeconds, setStartSeconds] = React.useState(0);
  const handledJumpTokenRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!videoJumpRequest) return;
    if (videoJumpRequest.docId !== resource.docId) return;
    if (handledJumpTokenRef.current === videoJumpRequest.token) return;
    handledJumpTokenRef.current = videoJumpRequest.token;
    setStartSeconds(videoJumpRequest.startSeconds);
    dispatch(clearVideoJumpRequest({ token: videoJumpRequest.token }));
  }, [dispatch, resource.docId, videoJumpRequest]);

  const embedConfig = React.useMemo(
    () => resolveVideoEmbedConfig(resource.originUrl, startSeconds),
    [resource.originUrl, startSeconds]
  );
  const contentPaddingClass = variant === 'main' ? 'p-12' : 'p-8';
  const containerWidthClass = variant === 'main' ? 'max-w-5xl' : 'max-w-3xl';

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#121212]">
      <div className={`flex-1 overflow-y-auto custom-scrollbar ${contentPaddingClass}`}>
        <div className={`${containerWidthClass} mx-auto`}>
          <div className="mb-8 pb-8 border-b border-slate-100 dark:border-[#2a2a2a]">
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-4 tracking-tight">
              {resource.name}
            </h1>
            <div className="flex items-center gap-4 text-[11px] font-bold text-slate-400 dark:text-[#a0a0a0] uppercase tracking-widest">
              <span className="flex items-center gap-1.5">
                <MaterialIcon name="smart_display" className="text-sm" />
                视频详情
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <MaterialIcon name="label" className="text-sm" />
                URL
              </span>
            </div>
          </div>

          {!embedConfig ? (
            <div className="rounded-3xl border border-dashed border-slate-200 dark:border-[#2a2a2a] bg-slate-50/60 dark:bg-[#1a1a1a] p-8 text-center text-slate-400">
              <div className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-[#a0a0a0] mb-2">
                视频暂不可预览
              </div>
              <p className="text-sm">当前链接暂不支持嵌入视频预览。</p>
            </div>
          ) : (
            <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-[#2a2a2a] dark:bg-[#1a1a1a]">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-[#a0a0a0]">
                    视频预览
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-100">
                    <MaterialIcon name="smart_display" className="text-base" />
                    <span>{embedConfig.title}</span>
                  </div>
                </div>
                <a
                  href={embedConfig.originUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:opacity-80"
                >
                  <span>打开原视频</span>
                  <MaterialIcon name="open_in_new" className="text-base" />
                </a>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-inner dark:border-[#2a2a2a] dark:bg-[#121212]">
                <div className="aspect-video w-full">
                  <iframe
                    src={embedConfig.embedUrl}
                    title={embedConfig.title}
                    className="h-full w-full"
                    scrolling="no"
                    allowFullScreen
                  />
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResourceVideoDetail;
