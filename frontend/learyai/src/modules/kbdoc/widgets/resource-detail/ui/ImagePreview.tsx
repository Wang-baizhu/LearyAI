// ImagePreview 负责为图片预览提供稳定入口并透传跳页参数。
import React from 'react';
import ImagePreviewViewport from './ImagePreviewViewport';

interface ImagePreviewProps {
  pages: Array<{ pageNumber: number; url: string }>;
  jumpToPage?: number;
  jumpToken?: number;
  onJumpHandled?: () => void;
  hasMore?: boolean;
  hasPrevious?: boolean;
  isLoadingMore?: boolean;
  isLoadingPrevious?: boolean;
  onLoadMore?: () => void;
  onLoadPrevious?: () => void;
  viewportClassName?: string;
}

const ImagePreview: React.FC<ImagePreviewProps> = ({
  pages,
  jumpToPage,
  jumpToken,
  onJumpHandled,
  hasMore,
  hasPrevious,
  isLoadingMore,
  isLoadingPrevious,
  onLoadMore,
  onLoadPrevious,
  viewportClassName = 'max-h-[70vh]',
}) => (
  <ImagePreviewViewport
    pages={pages}
    jumpToPage={jumpToPage}
    jumpToken={jumpToken}
    onJumpHandled={onJumpHandled}
    hasMore={hasMore}
    hasPrevious={hasPrevious}
    isLoadingMore={isLoadingMore}
    isLoadingPrevious={isLoadingPrevious}
    onLoadMore={onLoadMore}
    onLoadPrevious={onLoadPrevious}
    viewportClassName={viewportClassName}
  />
);

export default ImagePreview;
