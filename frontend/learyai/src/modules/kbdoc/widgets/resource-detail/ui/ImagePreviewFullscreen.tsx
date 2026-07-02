// ImagePreviewFullscreen 负责全屏图片预览中的缩放与拖拽浏览。
import React from 'react';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';

interface ImagePreviewFullscreenProps {
  page: { pageNumber: number; url: string };
  onClose: () => void;
}

const MAX_FULLSCREEN_ZOOM = 4;
const MIN_FULLSCREEN_ZOOM = 1;
const ZOOM_STEP = 0.25;

const clampZoom = (value: number) =>
  Math.min(MAX_FULLSCREEN_ZOOM, Math.max(MIN_FULLSCREEN_ZOOM, Number(value.toFixed(2))));

const resolveTouchDistance = (touches: React.TouchList) => {
  if (touches.length < 2) {
    return 0;
  }
  const [firstTouch, secondTouch] = [touches[0], touches[1]];
  const deltaX = firstTouch.clientX - secondTouch.clientX;
  const deltaY = firstTouch.clientY - secondTouch.clientY;
  return Math.hypot(deltaX, deltaY);
};

const ImagePreviewFullscreen: React.FC<ImagePreviewFullscreenProps> = ({ page, onClose }) => {
  const fullscreenViewportRef = React.useRef<HTMLDivElement | null>(null);
  const pinchStateRef = React.useRef<{ distance: number; zoom: number } | null>(null);
  const panStateRef = React.useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const previousFullscreenZoomRef = React.useRef(1);
  const [fullscreenZoom, setFullscreenZoom] = React.useState(1);

  const toggleZoom = React.useCallback(() => {
    setFullscreenZoom((prev) => (prev > 1 ? 1 : 2));
  }, []);

  React.useEffect(() => {
    const viewport = fullscreenViewportRef.current;
    if (!viewport) {
      return;
    }
    const previousZoom = previousFullscreenZoomRef.current;
    if (previousZoom === fullscreenZoom) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const centerX = (viewport.scrollLeft + viewport.clientWidth / 2) / previousZoom;
      const centerY = (viewport.scrollTop + viewport.clientHeight / 2) / previousZoom;
      viewport.scrollLeft = Math.max(0, centerX * fullscreenZoom - viewport.clientWidth / 2);
      viewport.scrollTop = Math.max(0, centerY * fullscreenZoom - viewport.clientHeight / 2);
      previousFullscreenZoomRef.current = fullscreenZoom;
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [fullscreenZoom]);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`预览第 ${page.pageNumber} 页`}>
      <button
        type="button"
        className="absolute inset-0"
        aria-label="关闭全屏预览"
        onClick={onClose}
      />
      <div className="relative z-10 flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950/95 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-white sm:px-6">
          <div className="flex items-center gap-3">
            <div className="text-xs font-black uppercase tracking-[0.3em] text-slate-300">
              图片全屏预览
            </div>
            <div className="text-sm font-semibold text-white/90">
              第 {page.pageNumber} 页
            </div>
            <div className="hidden text-xs text-slate-400 sm:block">
              双指缩放，单指拖动查看
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            <MaterialIcon name="close" className="text-base" />
            关闭
          </button>
        </div>
        <div
          ref={fullscreenViewportRef}
          className="flex-1 touch-none overflow-auto p-3 sm:p-6"
          onWheel={(event) => {
            event.preventDefault();
            setFullscreenZoom((prev) => clampZoom(prev + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)));
          }}
          onTouchStart={(event) => {
            const container = event.currentTarget;
            if (event.touches.length === 2) {
              pinchStateRef.current = {
                distance: resolveTouchDistance(event.touches),
                zoom: fullscreenZoom,
              };
              panStateRef.current = null;
              return;
            }
            if (event.touches.length === 1) {
              const touch = event.touches[0];
              panStateRef.current = {
                x: touch.clientX,
                y: touch.clientY,
                left: container.scrollLeft,
                top: container.scrollTop,
              };
            }
          }}
          onTouchMove={(event) => {
            const container = event.currentTarget;
            if (event.touches.length === 2 && pinchStateRef.current) {
              event.preventDefault();
              const nextDistance = resolveTouchDistance(event.touches);
              if (!nextDistance || !pinchStateRef.current.distance) {
                return;
              }
              const zoomRatio = nextDistance / pinchStateRef.current.distance;
              setFullscreenZoom(clampZoom(pinchStateRef.current.zoom * zoomRatio));
              return;
            }
            if (event.touches.length === 1 && panStateRef.current) {
              event.preventDefault();
              const touch = event.touches[0];
              const deltaX = touch.clientX - panStateRef.current.x;
              const deltaY = touch.clientY - panStateRef.current.y;
              container.scrollLeft = panStateRef.current.left - deltaX;
              container.scrollTop = panStateRef.current.top - deltaY;
            }
          }}
          onTouchEnd={() => {
            pinchStateRef.current = null;
            panStateRef.current = null;
          }}
        >
          <div
            className="flex min-h-full min-w-full items-start justify-center"
            style={{
              width: `${fullscreenZoom * 100}%`,
            }}
          >
            <img
              src={page.url}
              alt={`fullscreen-page-${page.pageNumber}`}
              className="block h-auto w-full cursor-zoom-in rounded-2xl object-contain"
              onDoubleClick={toggleZoom}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImagePreviewFullscreen;
