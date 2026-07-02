// useResourceCenterListState.test.ts 负责验证资源中心列表态 hook 会把参数透传给目录适配层。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useResourceCatalog: vi.fn(),
}));

vi.mock('../../../../../../resource/adapter/catalog/model/hooks/useResourceCatalog', () => ({
  useResourceCatalog: mocks.useResourceCatalog,
}));

import useResourceCenterListState from '../../useResourceCenterListState';

describe('useResourceCenterListState', () => {
  beforeEach(() => {
    mocks.useResourceCatalog.mockReset();
  });

  it('会把 active/docked 状态透传给资源目录适配层，并忽略已移除的模板插件参数', () => {
    mocks.useResourceCatalog.mockReturnValue({
      listState: {
        kind: 'mixed',
        itemCount: 14,
        sections: [
          { key: 'docs', panel: 'kbdoc', total: 5, isTemplate: false },
          { key: 'mindmap', panel: 'mindmap', total: 3, isTemplate: true },
        ],
      },
      dockedListState: null,
    });

    const result = useResourceCenterListState({
      search: 'AI',
      fileType: 'all',
      activeSelectedTemplateTag: '知识',
      activeSelectedTemplateSource: 'system',
      dockedSelectedTemplateTag: null,
      dockedSelectedTemplateSource: null,
      activePage: 2,
      dockedPage: 1,
      size: 2,
      kbId: 'kb-1',
      projectId: 'project-1',
      activeTab: 'all',
      dockedPanel: 'ai',
      enabledTemplatePlugins: [
        {
          pluginId: 'mindmap',
          name: 'mindmap',
          displayName: '思维导图',
          iconKey: 'account_tree',
          resourceLabel: '思维导图',
          generateLabel: '生成导图',
          sortOrder: 100,
          available: true,
        },
      ],
    });

    expect(mocks.useResourceCatalog).toHaveBeenCalledWith(
      expect.objectContaining({
        search: 'AI',
        activeTab: 'all',
        dockedPanel: 'ai',
        activeSelectedTemplateTag: '知识',
        activeSelectedTemplateSource: 'system',
      })
    );
    expect(result.listState.kind).toBe('mixed');
    expect(result.dockedListState).toBeNull();
  });

  it('会原样返回适配层给出的模板列表态结果', () => {
    mocks.useResourceCatalog.mockReturnValue({
      listState: {
        kind: 'template',
        availableTemplateTags: ['架构'],
        availableTemplateSources: ['system'],
      },
      dockedListState: {
        kind: 'template',
      },
    });

    const result = useResourceCenterListState({
      search: '',
      fileType: 'pdf',
      activeSelectedTemplateTag: null,
      activeSelectedTemplateSource: null,
      dockedSelectedTemplateTag: null,
      dockedSelectedTemplateSource: null,
      activePage: 1,
      dockedPage: 1,
      size: 10,
      kbId: 'kb-1',
      projectId: 'project-1',
      activeTab: 'mindmap',
      dockedPanel: 'quiz',
      enabledTemplatePlugins: [
        {
          pluginId: 'mindmap',
          name: 'mindmap',
          displayName: '思维导图',
          iconKey: 'account_tree',
          resourceLabel: '思维导图',
          generateLabel: '生成导图',
          sortOrder: 100,
          available: true,
        },
        {
          pluginId: 'quiz',
          name: 'quiz',
          displayName: '题目',
          iconKey: 'quiz',
          resourceLabel: '题目',
          generateLabel: '生成题目',
          sortOrder: 200,
          available: true,
        },
      ],
    });

    expect(mocks.useResourceCatalog).toHaveBeenCalledWith(
      expect.objectContaining({
        activeTab: 'mindmap',
        dockedPanel: 'quiz',
      })
    );
    expect(result.listState.kind).toBe('template');
    expect(result.listState.availableTemplateTags).toEqual(['架构']);
    expect(result.listState.availableTemplateSources).toEqual(['system']);
    expect(result.dockedListState?.kind).toBe('template');
  });
});
