// view 负责定义资源中心视图层共享的详情面板属性类型。
import type { UserSession } from '@/modules/auth';
import type { ResourceCenterDetailTabKey } from './panel';

export interface WhiteboardDetailConfig {
  boardId: string;
  title: string;
}

export interface ResourceDetailPanelProps {
  docId?: string | null;
  kbId?: string;
  projectId?: string;
  variant?: 'main' | 'sidebar';
  enableJump?: boolean;
  detailKind?: 'kbdoc' | 'template' | 'video' | 'whiteboard';
  templateId?: string;
  jumpToPage?: number;
  jumpToken?: number;
  onJumpHandled?: () => void;
  onOpenVideoDetailTab?: (docId: string, label: string) => void;
  onOpenResourceDetailTab?: (docId: string, label?: string) => void;
  onOpenTemplateDetailTab?: (templateId: string, label?: string) => void;
  isDarkMode?: boolean;
  toggleTheme?: () => void;
  user?: UserSession | null;
  onLogout?: () => void;
  onToggleCollapsed?: () => void;
  showCollapseToggle?: boolean;
  disableTemplatePointerEvents?: boolean;
  detailTabKey?: ResourceCenterDetailTabKey;
  whiteboardConfig?: WhiteboardDetailConfig;
}
