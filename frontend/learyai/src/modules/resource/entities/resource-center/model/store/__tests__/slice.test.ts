// slice.test.ts 负责验证资源中心 Redux 分片的状态迁移。
import { describe, expect, it } from 'vitest';
import reducer, {
  addReference,
  clearCitationJump,
  clearCurrentContext,
  clearVideoJumpRequest,
  clearDocNames,
  clearReferences,
  closeImport,
  openImport,
  openImportText,
  openImportUrl,
  requestCitationJump,
  requestAiPanelOpen,
  removeReferenceByDocId,
  requestVideoJump,
  setFileType,
  setPage,
  setSelectedTemplateSource,
  setSelectedTemplateTag,
  setSize,
  setCurrentContext,
  setReferencedResources,
  setSearch,
  toggleReference,
  upsertDocNames,
} from '../slice';

describe('resourceCenterSlice', () => {
  it('setSearch 会更新搜索词并重置页码', () => {
    const nextState = reducer(
      {
        search: '',
        fileType: 'all',
        selectedTemplateTags: { mindmap: null, question: null, card: null },
        selectedTemplateSources: { mindmap: null, question: null, card: null },
        pageByTab: { all: 3, kbdoc: 2, mindmap: 4, question: 5, card: 6 },
        size: 12,
        isImportOpen: false,
        isImportUrlOpen: false,
        isImportTextOpen: false,
        referencedResources: [],
        referencedResourcesByContext: {},
        docNameMapByScope: {},
        docNameMap: {},
        aiPanelOpenToken: null,
        citationJump: null,
        videoJumpRequest: null,
        currentContext: {},
      },
      setSearch('知识库')
    );

    expect(nextState.search).toBe('知识库');
    expect(nextState.pageByTab).toEqual({ all: 1, kbdoc: 1, mindmap: 1, question: 1, card: 1 });
  });

  it('setReferencedResources 与 addReference 会同步维护 docNameMap 且按 docId 去重', () => {
    const seeded = reducer(
      undefined,
      setReferencedResources([
        {
          id: 'doc-1',
          docId: 'doc-1',
          name: '产品说明',
          fileType: 'pdf',
          previewUrl: null,
        },
      ])
    );

    const nextState = reducer(
      seeded,
      addReference({
        id: 'doc-1-copy',
        docId: 'doc-1',
        name: '产品说明（更新）',
        fileType: 'pdf',
        previewUrl: null,
      })
    );

    expect(nextState.referencedResources).toHaveLength(1);
    expect(nextState.docNameMap).toEqual({ 'doc-1': '产品说明（更新）' });
  });

  it('upsertDocNames 会 trim 输入并忽略空值', () => {
    const nextState = reducer(
      undefined,
      upsertDocNames({
        context: { projectId: 'project-1', kbId: 'kb-1' },
        items: [
          { docId: ' doc-1 ', name: ' 方案一 ' },
          { docId: '   ', name: '忽略' },
          { docId: 'doc-2', name: '   ' },
        ],
      })
    );

    expect(nextState.docNameMapByScope['project-1::kb-1']).toEqual({ 'doc-1': '方案一' });
  });

  it('requestCitationJump 会优先使用传入 token', () => {
    const nextState = reducer(
      undefined,
      requestCitationJump({
        source: 'doc-1',
        pageText: '12',
        token: 123,
        sourceDetailTabKey: 'doc:doc-1',
      })
    );

    expect(nextState.citationJump).toEqual({
      source: 'doc-1',
      pageText: '12',
      token: 123,
      sourceDetailTabKey: 'doc:doc-1',
    });
  });

  it('setCurrentContext 会 trim projectId 与 kbId', () => {
    const seeded = reducer(
      undefined,
      setReferencedResources({
        context: { projectId: 'project-1', kbId: 'kb-1' },
        resources: [
          {
            id: 'doc-1',
            docId: 'doc-1',
            name: '产品说明',
            fileType: 'pdf',
            previewUrl: null,
          },
        ],
      })
    );
    const nextState = reducer(
      seeded,
      setCurrentContext({
        projectId: ' project-1 ',
        kbId: ' kb-1 ',
      })
    );

    expect(nextState.currentContext).toEqual({
      projectId: 'project-1',
      kbId: 'kb-1',
    });
    expect(nextState.referencedResources).toEqual([
      {
        id: 'doc-1',
        docId: 'doc-1',
        name: '产品说明',
        fileType: 'pdf',
        previewUrl: null,
      },
    ]);
    expect(nextState.docNameMap).toEqual({ 'doc-1': '产品说明' });
  });

  it('筛选与分页类 action 会更新对应状态，并在必要时重置页码', () => {
    const seeded = reducer(
      undefined,
      setPage({ tab: 'kbdoc', page: 4 })
    );

    const fileTypeState = reducer(seeded, setFileType('pdf'));
    const tagState = reducer(fileTypeState, setSelectedTemplateTag({ tab: 'mindmap', tag: '系统模板' }));
    const sourceState = reducer(
      tagState,
      setSelectedTemplateSource({ tab: 'question', source: 'custom' })
    );
    const sizeState = reducer(sourceState, setSize(24));

    expect(fileTypeState.fileType).toBe('pdf');
    expect(fileTypeState.pageByTab).toEqual({ all: 1, kbdoc: 1, mindmap: 1, question: 1, card: 1 });
    expect(tagState.selectedTemplateTags.mindmap).toBe('系统模板');
    expect(tagState.pageByTab.mindmap).toBe(1);
    expect(sourceState.selectedTemplateSources.question).toBe('custom');
    expect(sourceState.pageByTab.question).toBe(1);
    expect(sizeState.size).toBe(24);
    expect(sizeState.pageByTab).toEqual({ all: 1, kbdoc: 1, mindmap: 1, question: 1, card: 1 });
  });

  it('导入弹窗、引用切换与清理类 action 会维护集合状态', () => {
    const withImport = reducer(undefined, openImport());
    const withImportText = reducer(withImport, openImportText());
    const withImportUrl = reducer(withImportText, openImportUrl());
    const closedImport = reducer(withImportUrl, closeImport());
    const seeded = reducer(
      closedImport,
      setReferencedResources([
        {
          id: 'doc-1',
          docId: 'doc-1',
          name: '产品说明',
          fileType: 'pdf',
          previewUrl: null,
        },
      ])
    );

    const removed = reducer(seeded, removeReferenceByDocId('doc-1'));
    const added = reducer(
      removed,
      toggleReference({
        reference: {
          id: 'doc-2',
          docId: 'doc-2',
          name: '接入文档',
          fileType: 'docx',
          previewUrl: 'preview',
        },
        nextIsReference: true,
      })
    );
    const toggledOff = reducer(
      added,
      toggleReference({
        reference: {
          id: 'doc-2',
          docId: 'doc-2',
          name: '接入文档',
          fileType: 'docx',
          previewUrl: 'preview',
        },
        nextIsReference: false,
      })
    );
    const cleared = reducer(toggledOff, clearReferences(undefined));

    expect(withImport.isImportOpen).toBe(true);
    expect(withImportText.isImportTextOpen).toBe(true);
    expect(withImportText.isImportOpen).toBe(false);
    expect(withImportUrl.isImportUrlOpen).toBe(true);
    expect(withImportUrl.isImportOpen).toBe(false);
    expect(withImportUrl.isImportTextOpen).toBe(false);
    expect(closedImport.isImportOpen).toBe(false);
    expect(closedImport.isImportUrlOpen).toBe(false);
    expect(closedImport.isImportTextOpen).toBe(false);
    expect(removed.referencedResources).toEqual([]);
    expect(removed.docNameMap).toEqual({});
    expect(added.referencedResources).toHaveLength(1);
    expect(added.docNameMap['doc-2']).toBe('接入文档');
    expect(toggledOff.referencedResources).toEqual([]);
    expect(cleared.referencedResources).toEqual([]);
  });

  it('文档名、AI 面板与 citation/context 清理 action 会重置状态', () => {
    const seeded = reducer(
      reducer(
        reducer(
          reducer(undefined, upsertDocNames([{ docId: 'doc-1', name: '文档一' }])),
          requestAiPanelOpen()
        ),
        requestCitationJump({ source: 'doc-1', pageText: '2', token: 456 })
      ),
      setCurrentContext({ projectId: 'project-1', kbId: 'kb-1' })
    );

    const clearedDocNames = reducer(seeded, clearDocNames(undefined));
    const clearedCitation = reducer(clearedDocNames, clearCitationJump());
    const clearedContext = reducer(clearedCitation, clearCurrentContext());

    expect(seeded.aiPanelOpenToken).not.toBeNull();
    expect(clearedDocNames.docNameMap).toEqual({});
    expect(clearedCitation.citationJump).toBeNull();
    expect(clearedContext.currentContext).toEqual({});
    expect(clearedContext.referencedResources).toEqual([]);
  });

  it('requestVideoJump 与 clearVideoJumpRequest 会维护跨 tab 视频跳转请求', () => {
    const seeded = reducer(
      undefined,
      requestVideoJump({
        docId: 'doc-video-1',
        startSeconds: 7,
        token: 789,
      })
    );

    const ignored = reducer(seeded, clearVideoJumpRequest({ token: 790 }));
    const cleared = reducer(seeded, clearVideoJumpRequest({ token: 789 }));

    expect(seeded.videoJumpRequest).toEqual({
      docId: 'doc-video-1',
      startSeconds: 7,
      token: 789,
    });
    expect(ignored.videoJumpRequest).toEqual(seeded.videoJumpRequest);
    expect(cleared.videoJumpRequest).toBeNull();
  });
});
