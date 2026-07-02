// modules/resource/route 负责收敛资源模块路由路径、location.state 以及返回目标解析。
export interface ResourceRouteState {
  fromPath?: string;
  initialMobileView?: 'ai' | 'resource';
}

export const WORKSPACE_PATH = '/workspace';
export type WorkspaceRouteTab = 'quick-start' | 'project-management';

export const buildWorkspacePath = (tab: WorkspaceRouteTab = 'quick-start') => (
  tab === 'project-management' ? `${WORKSPACE_PATH}?tab=project-management` : WORKSPACE_PATH
);

export const buildProjectDetailPath = (projectId: string) => `/project/${projectId}`;

export const buildResourceCenterPath = (projectId: string, kbId: string) => `/resource-center/${projectId}/${kbId}`;

export const buildProjectTemplateFullscreenPath = (projectId: string, templateId: string) =>
  `/project/${projectId}/template/${templateId}`;

export const buildResourceDetailFullscreenPath = (
  projectId: string,
  kbId: string,
  detailKind: string,
  docId: string,
  options?: {
    page?: number;
    jump?: number;
  }
) => {
  const pathname = `/resource-center/${projectId}/${kbId}/fullscreen/${detailKind}/${docId}`;
  const searchParams = new URLSearchParams();
  if (options?.page != null) {
    searchParams.set('page', String(options.page));
  }
  if (options?.jump != null) {
    searchParams.set('jump', String(options.jump));
  }
  const search = searchParams.toString();
  return search ? `${pathname}?${search}` : pathname;
};

export const buildResourceRouteState = (
  fromPath: string,
  initialMobileView?: ResourceRouteState['initialMobileView'],
): ResourceRouteState => (
  {
    fromPath,
    ...(initialMobileView ? { initialMobileView } : {}),
  }
);

const isWorkspacePath = (path: string): boolean => {
  try {
    return new URL(path, 'http://local').pathname === WORKSPACE_PATH;
  } catch {
    return false;
  }
};

export const resolveResourceCenterBackTarget = (
  projectId: string | undefined,
  state: unknown
): string => {
  const fromPath = readResourceRouteState(state).fromPath;
  if (typeof fromPath === 'string' && isWorkspacePath(fromPath)) {
    return fromPath;
  }
  if (projectId && fromPath === buildProjectDetailPath(projectId)) {
    return fromPath;
  }
  return WORKSPACE_PATH;
};

export const resolveProjectDetailBackTarget = (state: unknown): string => {
  const fromPath = readResourceRouteState(state).fromPath;
  if (typeof fromPath === 'string' && isWorkspacePath(fromPath)) {
    return fromPath;
  }
  return buildWorkspacePath('project-management');
};

export const resolveResourceDetailFullscreenBackTarget = (
  projectId: string | undefined,
  kbId: string | undefined,
  state: unknown
): string => {
  const fromPath = readResourceRouteState(state).fromPath;
  if (projectId && kbId) {
    const resourceCenterPath = buildResourceCenterPath(projectId, kbId);
    if (fromPath === resourceCenterPath) {
      return fromPath;
    }
    return resourceCenterPath;
  }
  return WORKSPACE_PATH;
};

export const resolveProjectTemplateFullscreenBackTarget = (
  projectId: string | undefined,
  state: unknown
): string => {
  const fromPath = readResourceRouteState(state).fromPath;
  if (typeof fromPath === 'string' && fromPath.trim().length > 0) {
    return fromPath;
  }
  if (projectId) {
    return buildProjectDetailPath(projectId);
  }
  return WORKSPACE_PATH;
};

const readResourceRouteState = (state: unknown): ResourceRouteState => {
  if (!state || typeof state !== 'object') {
    return {};
  }
  const fromPath = 'fromPath' in state ? state.fromPath : undefined;
  const initialMobileView = 'initialMobileView' in state ? state.initialMobileView : undefined;
  return {
    ...(typeof fromPath === 'string' ? { fromPath } : {}),
    ...(initialMobileView === 'ai' || initialMobileView === 'resource' ? { initialMobileView } : {}),
  };
};
