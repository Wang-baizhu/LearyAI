// slice.extra.test.ts 负责补充资源中心 Redux 分片的剩余状态迁移测试。
import { describe, expect, it, vi } from 'vitest';
import reducer, {
  clearCitationJump,
  clearCurrentContext,
  clearDocNames,
  clearReferences,
  closeImport,
  openImport,
  openImportText,
  openImportUrl,
  removeReferenceByDocId,
  requestAiPanelOpen,
  setCurrentContext,
  setReferencedResources,
  setFileType,
  setPage,
  setSelectedTemplateSource,
  setSelectedTemplateTag,
  setSize,
  toggleReference,
} from '../slice';

const createState = () =>
  reducer(undefined, { type: 'init' }) as ReturnType<typeof reducer>;

describe('resourceCenterSlice extra reducers', () => {
  it('会在筛选切换时重置页码，并支持页码/页尺寸更新', () => {
    const seeded = reducer(createState(), setPage({ tab: 'kbdoc', page: 3 }));
    const next = reducer(
      reducer(
        reducer(
          seeded,
          setFileType('pdf')
        ),
        setSelectedTemplateTag({ tab: 'mindmap', tag: '架构' })
      ),
      setSelectedTemplateSource({ tab: 'question', source: 'system' })
    );

    expect(next.fileType).toBe('pdf');
    expect(next.selectedTemplateTags.mindmap).toBe('架构');
    expect(next.selectedTemplateSources.question).toBe('system');
    expect(next.pageByTab).toEqual({ all: 1, kbdoc: 1, mindmap: 1, question: 1, card: 1 });

    const sized = reducer(next, setSize(24));
    expect(sized.size).toBe(24);
    expect(sized.pageByTab).toEqual({ all: 1, kbdoc: 1, mindmap: 1, question: 1, card: 1 });
  });

  it('toggleReference 会新增/移除引用，并维护 docNameMap', () => {
    const reference = {
      id: 'doc-1',
      docId: 'doc-1',
      name: '说明书',
      fileType: 'pdf' as const,
      previewUrl: null,
    };

    const added = reducer(
      createState(),
      toggleReference({ reference, nextIsReference: true })
    );
    expect(added.referencedResources).toEqual([reference]);
    expect(added.docNameMap).toEqual({ 'doc-1': '说明书' });

    const removed = reducer(
      added,
      toggleReference({ reference, nextIsReference: false })
    );
    expect(removed.referencedResources).toEqual([]);
    expect(removed.docNameMap).toEqual({ 'doc-1': '说明书' });
  });

  it('removeReferenceByDocId / clearReferences / clearDocNames 会清空对应状态', () => {
    const seeded = {
      ...createState(),
      referencedResources: [
        {
          id: 'doc-1',
          docId: 'doc-1',
          name: '文档 1',
          fileType: 'pdf' as const,
          previewUrl: null,
        },
      ],
      docNameMap: { 'doc-1': '文档 1' },
    };

    const removed = reducer(seeded, removeReferenceByDocId('doc-1'));
    expect(removed.referencedResources).toEqual([]);
    expect(removed.docNameMap).toEqual({});

    const clearedRefs = reducer(seeded, clearReferences(undefined));
    expect(clearedRefs.referencedResources).toEqual([]);

    const clearedNames = reducer(seeded, clearDocNames(undefined));
    expect(clearedNames.docNameMap).toEqual({});
  });

  it('引用会按 projectId 与 kbId 分桶，切换上下文时只暴露当前桶', () => {
    const scoped = reducer(
      reducer(
        createState(),
        setReferencedResources({
          context: { projectId: 'project-1', kbId: 'kb-1' },
          resources: [
            {
              id: 'doc-1',
              docId: 'doc-1',
              name: '文档 1',
              fileType: 'pdf',
              previewUrl: null,
            },
          ],
        })
      ),
      setReferencedResources({
        context: { projectId: 'project-1', kbId: 'kb-2' },
        resources: [
          {
            id: 'doc-2',
            docId: 'doc-2',
            name: '文档 2',
            fileType: 'docx',
            previewUrl: null,
          },
        ],
      })
    );

    const kb1State = reducer(
      scoped,
      setCurrentContext({ projectId: 'project-1', kbId: 'kb-1' })
    );
    const kb2State = reducer(
      kb1State,
      setCurrentContext({ projectId: 'project-1', kbId: 'kb-2' })
    );
    const clearedKb2State = reducer(
      kb2State,
      clearReferences({ projectId: 'project-1', kbId: 'kb-2' })
    );

    expect(kb1State.referencedResources.map((item) => item.docId)).toEqual(['doc-1']);
    expect(kb2State.referencedResources.map((item) => item.docId)).toEqual(['doc-2']);
    expect(
      clearedKb2State.referencedResourcesByContext['project-1::kb-1'].map((item) => item.docId)
    ).toEqual(['doc-1']);
    expect(clearedKb2State.referencedResourcesByContext['project-1::kb-2']).toEqual([]);
  });

  it('会维护导入弹窗、引用跳转和上下文状态', () => {
    vi.spyOn(Date, 'now').mockReturnValue(456);

    const opened = reducer(createState(), openImport());
    expect(opened.isImportOpen).toBe(true);
    const openedText = reducer(opened, openImportText());
    expect(openedText.isImportTextOpen).toBe(true);
    expect(openedText.isImportOpen).toBe(false);
    const openedUrl = reducer(openedText, openImportUrl());
    expect(openedUrl.isImportUrlOpen).toBe(true);
    expect(openedUrl.isImportOpen).toBe(false);
    expect(openedUrl.isImportTextOpen).toBe(false);
    const closed = reducer(openedUrl, closeImport());
    expect(closed.isImportOpen).toBe(false);
    expect(closed.isImportUrlOpen).toBe(false);
    expect(closed.isImportTextOpen).toBe(false);

    const aiOpened = reducer(createState(), requestAiPanelOpen());
    expect(aiOpened.aiPanelOpenToken).toBe(456);

    const clearedJump = reducer(
      {
        ...createState(),
        citationJump: { source: 'doc-1', pageText: '3', token: 1 },
        currentContext: { projectId: 'project-1', kbId: 'kb-1' },
      },
      clearCitationJump()
    );
    expect(clearedJump.citationJump).toBeNull();
    expect(reducer(clearedJump, clearCurrentContext()).currentContext).toEqual({});
  });
});
