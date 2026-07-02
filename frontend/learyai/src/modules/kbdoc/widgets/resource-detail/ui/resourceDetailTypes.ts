// resourceDetailTypes 负责声明资源详情视图的输入契约。
import type React from 'react';
import type { ResourceDetail as ResourceDetailType } from '../../../entities/resource';
import type { UserSession } from '../../../../auth';

export interface ResourceDetailProps {
  resource: ResourceDetailType;
  projectId?: string;
  onJumpHandled?: () => void;
  onRequestJump?: (page: number, token: number) => void;
  previewPages?: Array<{ pageNumber: number; url: string }>;
  textPreviewChunks?: Array<{ chunkSec: number; text: string }>;
  isPreviewLoading?: boolean;
  isPreviewLoadingMore?: boolean;
  isPreviewLoadingPrevious?: boolean;
  hasMorePreview?: boolean;
  hasPreviousPreview?: boolean;
  isPreviewJumpFailed?: boolean;
  onLoadMorePreview?: () => void;
  onLoadPreviousPreview?: () => void;
  isTextPreviewLoading?: boolean;
  isTextPreviewLoadingMore?: boolean;
  isTextPreviewLoadingPrevious?: boolean;
  hasMoreTextPreview?: boolean;
  hasPreviousTextPreview?: boolean;
  isTextJumpFailed?: boolean;
  onLoadMoreTextPreview?: () => void;
  onLoadPreviousTextPreview?: () => void;
  jumpToPage?: number;
  jumpToken?: number;
  isDarkMode?: boolean;
  toggleTheme?: () => void;
  user?: UserSession | null;
  onLogout?: () => void;
  variant?: 'main' | 'sidebar';
  onOpenVideoDetailTab?: (docId: string, label: string) => void;
  onToggleCollapsed?: () => void;
  showCollapseToggle?: boolean;
  headerActions?: React.ReactNode;
}
