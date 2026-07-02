// useReferenceSync.test.ts 负责验证引用同步 hook 的增删派发逻辑。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useEffect: vi.fn((effect: () => void) => effect()),
  dispatch: vi.fn(),
  setReferencedResources: vi.fn((payload) => ({ type: 'resource/setReferencedResources', payload })),
  mapListItemToReference: vi.fn(),
  resolveDocReferenceState: vi.fn(),
}));

vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useEffect: mocks.useEffect,
  };
});

vi.mock('../../../../../entities/resource-center', () => ({
  setReferencedResources: mocks.setReferencedResources,
  mapListItemToReference: mocks.mapListItemToReference,
  resolveDocReferenceState: mocks.resolveDocReferenceState,
}));

import useReferenceSync from '../../useReferenceSync';

describe('useReferenceSync', () => {
  beforeEach(() => {
    mocks.useEffect.mockClear();
    mocks.dispatch.mockReset();
    mocks.setReferencedResources.mockReset();
    mocks.setReferencedResources.mockImplementation((payload) => ({
      type: 'resource/setReferencedResources',
      payload,
    }));
    mocks.mapListItemToReference.mockReset();
    mocks.mapListItemToReference.mockImplementation((item) => ({
      id: item.docId,
      docId: item.docId,
      name: item.name,
      fileType: item.fileType,
      previewUrl: item.previewUrl ?? null,
    }));
    mocks.resolveDocReferenceState.mockReset();
  });

  it('在列表为空或作用域缺失时不会派发同步动作', () => {
    useReferenceSync({
      listItems: [],
      referencedRef: { current: [] },
      dispatch: mocks.dispatch,
      projectId: 'project-1',
      kbId: 'kb-1',
    });

    useReferenceSync({
      listItems: [
        {
          docId: 'doc-1',
          name: '文档一',
          fileType: 'pdf',
          previewUrl: null,
          status: 'DONE',
          size: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      referencedRef: { current: [] },
      dispatch: mocks.dispatch,
      projectId: '',
      kbId: 'kb-1',
    });

    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it('会补充新引用并移除已取消引用的文档', () => {
    mocks.resolveDocReferenceState.mockImplementation(({ docId }) => docId === 'doc-2');

    useReferenceSync({
      listItems: [
        {
          docId: 'doc-1',
          name: '旧文档',
          fileType: 'pdf',
          previewUrl: null,
          status: 'DONE',
          size: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        {
          docId: 'doc-2',
          name: '新文档',
          fileType: 'docx',
          previewUrl: 'preview',
          status: 'DONE',
          size: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        {
          docId: 'doc-2',
          name: '重复文档',
          fileType: 'docx',
          previewUrl: 'preview',
          status: 'DONE',
          size: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      referencedRef: {
        current: [{ id: 'doc-1', docId: 'doc-1', name: '旧文档', fileType: 'pdf', previewUrl: null }],
      },
      dispatch: mocks.dispatch,
      projectId: 'project-1',
      kbId: 'kb-1',
    });

    expect(mocks.mapListItemToReference).toHaveBeenCalledTimes(1);
    expect(mocks.setReferencedResources).toHaveBeenCalledWith({
      context: { projectId: 'project-1', kbId: 'kb-1' },
      resources: [
        {
          id: 'doc-2',
          docId: 'doc-2',
          name: '新文档',
          fileType: 'docx',
          previewUrl: 'preview',
        },
      ],
    });
    expect(mocks.dispatch).toHaveBeenCalledWith({
      type: 'resource/setReferencedResources',
      payload: {
        context: { projectId: 'project-1', kbId: 'kb-1' },
        resources: [
          {
            id: 'doc-2',
            docId: 'doc-2',
            name: '新文档',
            fileType: 'docx',
            previewUrl: 'preview',
          },
        ],
      },
    });
  });

  it('当引用集合没有变化时不会重复 dispatch', () => {
    mocks.resolveDocReferenceState.mockReturnValue(true);

    useReferenceSync({
      listItems: [
        {
          docId: 'doc-1',
          name: '文档一',
          fileType: 'pdf',
          previewUrl: null,
          status: 'DONE',
          size: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      referencedRef: {
        current: [{ id: 'doc-1', docId: 'doc-1', name: '文档一', fileType: 'pdf', previewUrl: null }],
      },
      dispatch: mocks.dispatch,
      projectId: 'project-1',
      kbId: 'kb-1',
    });

    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
});
