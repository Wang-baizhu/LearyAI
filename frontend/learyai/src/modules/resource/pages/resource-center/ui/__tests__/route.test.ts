// route.test.ts 负责验证资源模块路由返回目标解析与路径拼装。
import { describe, expect, it } from 'vitest';

import {
  WORKSPACE_PATH,
  buildWorkspacePath,
  buildProjectDetailPath,
  buildProjectTemplateFullscreenPath,
  buildResourceCenterPath,
  buildResourceDetailFullscreenPath,
  buildResourceRouteState,
  resolveProjectDetailBackTarget,
  resolveProjectTemplateFullscreenBackTarget,
  resolveResourceCenterBackTarget,
  resolveResourceDetailFullscreenBackTarget,
} from '../../../../route';

describe('resource route helpers', () => {
  it('会解析资源中心页的合法返回来源', () => {
    expect(resolveResourceCenterBackTarget('project-1', buildResourceRouteState(WORKSPACE_PATH))).toBe(
      WORKSPACE_PATH
    );
    expect(
      resolveResourceCenterBackTarget(
        'project-1',
        buildResourceRouteState(buildWorkspacePath('project-management'))
      )
    ).toBe(buildWorkspacePath('project-management'));
    expect(
      resolveResourceCenterBackTarget('project-1', buildResourceRouteState(buildProjectDetailPath('project-1')))
    ).toBe(buildProjectDetailPath('project-1'));
  });

  it('会将资源中心页的非法来源回退到工作区', () => {
    expect(
      resolveResourceCenterBackTarget('project-1', buildResourceRouteState(buildProjectDetailPath('project-2')))
    ).toBe(WORKSPACE_PATH);
    expect(resolveResourceCenterBackTarget('project-1', buildResourceRouteState('/random'))).toBe(WORKSPACE_PATH);
    expect(resolveResourceCenterBackTarget('project-1', null)).toBe(WORKSPACE_PATH);
  });

  it('会为项目详情页保留工作区来源，否则回退到空间管理 tab', () => {
    expect(resolveProjectDetailBackTarget(buildResourceRouteState(WORKSPACE_PATH))).toBe(WORKSPACE_PATH);
    expect(resolveProjectDetailBackTarget(buildResourceRouteState(buildWorkspacePath('project-management')))).toBe(
      buildWorkspacePath('project-management')
    );
    expect(resolveProjectDetailBackTarget(buildResourceRouteState('/random'))).toBe(
      buildWorkspacePath('project-management')
    );
    expect(resolveProjectDetailBackTarget(null)).toBe(buildWorkspacePath('project-management'));
  });

  it('会为独立模板全屏页优先保留来源，否则回退到项目详情或工作区', () => {
    expect(
      resolveProjectTemplateFullscreenBackTarget(
        'project-1',
        buildResourceRouteState('/workspace')
      )
    ).toBe('/workspace');
    expect(resolveProjectTemplateFullscreenBackTarget('project-1', null)).toBe(buildProjectDetailPath('project-1'));
    expect(resolveProjectTemplateFullscreenBackTarget(undefined, null)).toBe(WORKSPACE_PATH);
  });

  it('会优先返回全屏详情对应的资源中心，否则回退到资源中心或工作区', () => {
    expect(
      resolveResourceDetailFullscreenBackTarget(
        'project-1',
        'kb-1',
        buildResourceRouteState(buildResourceCenterPath('project-1', 'kb-1'))
      )
    ).toBe(buildResourceCenterPath('project-1', 'kb-1'));
    expect(
      resolveResourceDetailFullscreenBackTarget(
        'project-1',
        'kb-1',
        buildResourceRouteState(buildResourceCenterPath('project-1', 'kb-2'))
      )
    ).toBe(buildResourceCenterPath('project-1', 'kb-1'));
    expect(resolveResourceDetailFullscreenBackTarget(undefined, 'kb-1', null)).toBe(WORKSPACE_PATH);
  });

  it('会拼装资源模块规范路径与 state', () => {
    expect(buildWorkspacePath()).toBe('/workspace');
    expect(buildWorkspacePath('project-management')).toBe('/workspace?tab=project-management');
    expect(buildProjectTemplateFullscreenPath('project-1', 'tpl-1')).toBe('/project/project-1/template/tpl-1');
    expect(buildResourceCenterPath('project-1', 'kb-1')).toBe('/resource-center/project-1/kb-1');
    expect(buildResourceDetailFullscreenPath('project-1', 'kb-1', 'kbdoc', 'doc-1', { page: 12, jump: 34 })).toBe(
      '/resource-center/project-1/kb-1/fullscreen/kbdoc/doc-1?page=12&jump=34'
    );
    expect(buildResourceRouteState('/project/project-1')).toEqual({
      fromPath: '/project/project-1',
    });
    expect(buildResourceRouteState('/workspace', 'ai')).toEqual({
      fromPath: '/workspace',
      initialMobileView: 'ai',
    });
  });
});
