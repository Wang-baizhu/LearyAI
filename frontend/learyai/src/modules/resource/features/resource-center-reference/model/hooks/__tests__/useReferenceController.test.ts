// useReferenceController.test.ts 负责验证引用跳转与引用状态编排。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useRef: vi.fn(),
  useMemo: vi.fn((factory: () => unknown) => factory()),
  useCallback: vi.fn((fn: (...args: never[]) => unknown) => fn),
  useEffect: vi.fn((effect: () => void | (() => void)) => effect()),
  useReferenceSync: vi.fn(),
  enqueueToast: vi.fn((payload) => ({ type: 'toast/enqueue', payload })),
  clearCitationJump: vi.fn(() => ({ type: 'resource/clearCitationJump' })),
  clearReferences: vi.fn(() => ({ type: 'resource/clearReferences' })),
  setReferencedResources: vi.fn((payload) => ({ type: 'resource/setReferencedResources', payload })),
  toggleReference: vi.fn((payload) => ({ type: 'resource/toggleReference', payload })),
  setStoredReferenceState: vi.fn(),
  clearStoredReferenceState: vi.fn(),
  resolveDocReferenceState: vi.fn(),
  dispatch: vi.fn(),
}));

vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useRef: mocks.useRef,
    useMemo: mocks.useMemo,
    useCallback: mocks.useCallback,
    useEffect: mocks.useEffect,
  };
});

vi.mock('../../useReferenceSync', () => ({
  default: mocks.useReferenceSync,
}));

vi.mock('@/app/store/ui/toastSlice', () => ({
  enqueueToast: mocks.enqueueToast,
}));

vi.mock('@/modules/resource/entities/resource-center', async () => {
  const actual = await vi.importActual('@/modules/resource/entities/resource-center');
  return {
    ...actual,
    clearCitationJump: mocks.clearCitationJump,
    clearReferences: mocks.clearReferences,
    setReferencedResources: mocks.setReferencedResources,
    toggleReference: mocks.toggleReference,
    clearStoredReferenceState: mocks.clearStoredReferenceState,
    resolveDocReferenceState: mocks.resolveDocReferenceState,
    setStoredReferenceState: mocks.setStoredReferenceState,
  };
});

import useReferenceController from '../../useReferenceController';

const queueUseRefValues = (...values: unknown[]) => {
  values.forEach((value) => {
    mocks.useRef.mockImplementationOnce(() => ({ current: value }));
  });
};

describe('useReferenceController', () => {
  beforeEach(() => {
    mocks.useRef.mockReset();
    mocks.useMemo.mockClear();
    mocks.useCallback.mockClear();
    mocks.useEffect.mockClear();
    mocks.useReferenceSync.mockClear();
    mocks.enqueueToast.mockClear();
    mocks.clearCitationJump.mockClear();
    mocks.clearReferences.mockClear();
    mocks.setReferencedResources.mockClear();
    mocks.toggleReference.mockClear();
    mocks.setStoredReferenceState.mockClear();
    mocks.clearStoredReferenceState.mockClear();
    mocks.resolveDocReferenceState.mockClear();
    mocks.dispatch.mockClear();
  });

  it('会基于 citationJump 解析跳转目标', async () => {
    const kbdocItems = [
      {
        docId: 'doc-1',
        name: '文档一',
        fileType: 'pdf',
        previewUrl: null,
        status: 'DONE',
        size: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ] as never[];
    const referencedResources = [
      { id: 'doc-1', docId: 'doc-1', name: '文档一', fileType: 'pdf', previewUrl: null },
    ] as never[];

    queueUseRefValues(kbdocItems, referencedResources, []);

    const onOpenDetailTab = vi.fn();

    const controller = useReferenceController({
      dispatch: mocks.dispatch as never,
      projectId: 'project-1',
      kbId: 'kb-1',
      docId: 'doc-1',
      referencedResources,
      syncItems: kbdocItems,
      referenceSourceItems: kbdocItems,
      docOptions: [],
      isReferenceSourceReady: true,
      citationJump: {
        source: 'doc-1',
        pageText: '3-5',
        token: 7,
        sourceDetailTabKey: 'doc:root',
      },
      onOpenDetailTab,
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(controller.fallbackDocRef).toEqual({
      id: 'doc-1',
      name: '文档一',
    });
    expect(controller.referenceSourceItems).toBe(kbdocItems);
    expect(controller.sidebarResources).toHaveLength(1);
    expect(controller.sidebarReferenced).toHaveLength(1);
    expect(controller.referencedDocRefs).toEqual([
      { id: 'doc-1', name: '文档一' },
    ]);
    expect(onOpenDetailTab).toHaveBeenCalledWith({
      docId: 'doc-1',
      label: '文档一',
      kind: 'kbdoc',
      jumpToPage: 3,
      jumpToken: 7,
      autoMergeToActiveGroup: true,
      mergeTargetKey: 'doc:root',
    });
    expect(mocks.dispatch).toHaveBeenCalledWith({ type: 'resource/clearCitationJump' });
  });

  it('会允许 url 资源走文本类引用跳转', async () => {
    const kbdocItems = [
      {
        docId: 'doc-url',
        name: '网页链接',
        fileType: 'url',
        previewUrl: null,
        status: 'DONE',
        size: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ] as never[];
    const referencedResources = [
      { id: 'doc-url', docId: 'doc-url', name: '网页链接', fileType: 'url', previewUrl: null },
    ] as never[];

    queueUseRefValues(kbdocItems, referencedResources, []);

    const onOpenDetailTab = vi.fn();

    useReferenceController({
      dispatch: mocks.dispatch as never,
      projectId: 'project-1',
      kbId: 'kb-1',
      docId: 'doc-url',
      referencedResources,
      syncItems: kbdocItems,
      referenceSourceItems: kbdocItems,
      docOptions: [],
      isReferenceSourceReady: true,
      citationJump: {
        source: 'doc-url',
        pageText: '12',
        token: 11,
      },
      onOpenDetailTab,
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(onOpenDetailTab).toHaveBeenCalledWith({
      docId: 'doc-url',
      label: '网页链接',
      kind: 'kbdoc',
      jumpToPage: 12,
      jumpToken: 11,
      autoMergeToActiveGroup: true,
      mergeTargetKey: undefined,
    });
  });

  it('引用目标不在本地列表且 options 也无匹配时会提示可能已删除', async () => {
    const kbdocItems = [
      {
        docId: 'doc-1',
        name: '文档一',
        fileType: 'pdf',
        previewUrl: null,
        status: 'DONE',
        size: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ] as never[];
    const referencedResources = [] as never[];

    queueUseRefValues(kbdocItems, referencedResources, []);

    const onOpenDetailTab = vi.fn();

    useReferenceController({
      dispatch: mocks.dispatch as never,
      projectId: 'project-1',
      kbId: 'kb-1',
      docId: 'doc-1',
      referencedResources,
      syncItems: kbdocItems,
      referenceSourceItems: kbdocItems,
      docOptions: [],
      isReferenceSourceReady: true,
      citationJump: {
        source: 'doc-missing',
        pageText: '2',
        token: 9,
      },
      onOpenDetailTab,
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(mocks.enqueueToast).toHaveBeenCalledWith({
      variant: 'error',
      message: '引用资源可能已删除',
    });
    expect(mocks.dispatch).toHaveBeenCalledWith({
      type: 'toast/enqueue',
      payload: {
        variant: 'error',
        message: '引用资源可能已删除',
      },
    });
    expect(onOpenDetailTab).not.toHaveBeenCalled();
  });

  it('会在列表未命中时回退使用 options 中的 docId 与 name 打开详情', async () => {
    const kbdocItems = [] as never[];
    const referencedResources = [] as never[];

    queueUseRefValues(kbdocItems, referencedResources, [{ docId: 'doc-2', name: '文档二', status: 'DONE' }]);

    const onOpenDetailTab = vi.fn();

    const controller = useReferenceController({
      dispatch: mocks.dispatch as never,
      projectId: 'project-1',
      kbId: 'kb-1',
      docId: 'doc-1',
      referencedResources,
      syncItems: kbdocItems,
      referenceSourceItems: kbdocItems,
      docOptions: [{ docId: 'doc-2', name: '文档二', status: 'DONE' }],
      isReferenceSourceReady: true,
      citationJump: {
        source: 'doc-2',
        pageText: '5',
        token: 10,
      },
      onOpenDetailTab,
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(controller.sidebarResources).toEqual([
      expect.objectContaining({
        id: 'doc-2',
        title: '文档二',
        status: 'DONE',
      }),
    ]);
    expect(onOpenDetailTab).toHaveBeenCalledWith({
      docId: 'doc-2',
      label: '文档二',
      kind: 'kbdoc',
      jumpToPage: 5,
      jumpToken: 10,
      autoMergeToActiveGroup: true,
      mergeTargetKey: undefined,
    });
    expect(mocks.enqueueToast).not.toHaveBeenCalled();
  });

  it('引用源未就绪时不会过早提示已删除', () => {
    const kbdocItems = [] as never[];
    const referencedResources = [] as never[];

    queueUseRefValues(kbdocItems, referencedResources, []);

    const onOpenDetailTab = vi.fn();

    useReferenceController({
      dispatch: mocks.dispatch as never,
      projectId: 'project-1',
      kbId: 'kb-1',
      docId: 'doc-1',
      referencedResources,
      syncItems: kbdocItems,
      referenceSourceItems: kbdocItems,
      docOptions: [],
      isReferenceSourceReady: false,
      citationJump: {
        source: 'doc-missing',
        pageText: '2',
        token: 9,
      },
      onOpenDetailTab,
    });

    expect(onOpenDetailTab).not.toHaveBeenCalled();
    expect(mocks.enqueueToast).not.toHaveBeenCalled();
    expect(mocks.dispatch).not.toHaveBeenCalledWith({ type: 'resource/clearCitationJump' });
  });

  it('切换、清空和删除引用时会同步本地存储与派发状态', () => {
    const kbdocItems = [
      {
        docId: 'doc-1',
        name: '文档一',
        fileType: 'pdf',
        previewUrl: null,
        status: 'DONE',
        size: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        docId: 'doc-2',
        name: '文档二',
        fileType: 'docx',
        previewUrl: 'preview',
        status: 'DONE',
        size: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ] as never[];
    const referencedResources = [
      { id: 'doc-1', docId: 'doc-1', name: '文档一', fileType: 'pdf', previewUrl: null },
    ] as never[];

    queueUseRefValues(kbdocItems, referencedResources, []);
    mocks.resolveDocReferenceState.mockReturnValue(false);

    const controller = useReferenceController({
      dispatch: mocks.dispatch as never,
      projectId: 'project-1',
      kbId: 'kb-1',
      docId: 'doc-1',
      referencedResources,
      syncItems: kbdocItems,
      referenceSourceItems: kbdocItems,
      docOptions: [],
      isReferenceSourceReady: true,
      citationJump: null,
      onOpenDetailTab: vi.fn(),
    });

    controller.handleToggleReference({
      id: 'doc-2',
      title: '文档二',
      file: { kind: 'docx', url: 'preview' },
    } as never);
    expect(mocks.setStoredReferenceState).toHaveBeenCalledWith(
      { projectId: 'project-1', kbId: 'kb-1', docId: 'doc-2' },
      true
    );
    expect(mocks.toggleReference).toHaveBeenCalledWith({
      context: { projectId: 'project-1', kbId: 'kb-1' },
      reference: {
        id: 'doc-2',
        docId: 'doc-2',
        name: '文档二',
        fileType: 'docx',
        previewUrl: 'preview',
      },
      nextIsReference: true,
    });

    controller.handleListToggleReference(kbdocItems[1] as never);
    expect(mocks.resolveDocReferenceState).toHaveBeenCalledWith({
      projectId: 'project-1',
      kbId: 'kb-1',
      docId: 'doc-2',
      status: 'DONE',
    });
    expect(mocks.toggleReference).toHaveBeenLastCalledWith({
      context: { projectId: 'project-1', kbId: 'kb-1' },
      reference: {
        id: 'doc-2',
        docId: 'doc-2',
        name: '文档二',
        fileType: 'docx',
        previewUrl: 'preview',
      },
      nextIsReference: true,
    });

    controller.handleClearReferences();
    expect(mocks.clearReferences).toHaveBeenCalledWith({
      projectId: 'project-1',
      kbId: 'kb-1',
    });
    expect(mocks.setStoredReferenceState).toHaveBeenCalledWith(
      { projectId: 'project-1', kbId: 'kb-1', docId: 'doc-1' },
      false
    );

    controller.handleResourceDeleted('doc-1');
    expect(mocks.clearStoredReferenceState).toHaveBeenCalledWith({
      projectId: 'project-1',
      kbId: 'kb-1',
      docId: 'doc-1',
    });
    expect(mocks.setReferencedResources).toHaveBeenLastCalledWith({
      context: { projectId: 'project-1', kbId: 'kb-1' },
      resources: [],
    });
  });
});
