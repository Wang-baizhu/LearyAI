// referenceStorage.test.ts 负责验证资源引用状态的本地存储逻辑。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  safeLocalStorageGet: vi.fn(),
  safeLocalStorageSet: vi.fn(),
  safeLocalStorageRemove: vi.fn(),
}));

vi.mock('@/shared/lib/safeLocalStorage', () => ({
  safeLocalStorageGet: mocks.safeLocalStorageGet,
  safeLocalStorageSet: mocks.safeLocalStorageSet,
  safeLocalStorageRemove: mocks.safeLocalStorageRemove,
}));

import {
  clearStoredReferenceState,
  getStoredReferenceState,
  resolveDocReferenceState,
  setStoredReferenceState,
} from '../referenceStorage';

const storageKey = 'learyai:kbdoc:reference:project-1:kb-1:doc-1';

describe('referenceStorage', () => {
  beforeEach(() => {
    mocks.safeLocalStorageGet.mockReset();
    mocks.safeLocalStorageSet.mockReset();
    mocks.safeLocalStorageRemove.mockReset();
  });

  it('getStoredReferenceState 会在 key 不完整时默认返回 true', () => {
    expect(getStoredReferenceState({ projectId: 'project-1', kbId: '', docId: 'doc-1' })).toBe(
      true
    );
    expect(mocks.safeLocalStorageGet).not.toHaveBeenCalled();
  });

  it('getStoredReferenceState 会把 false 标记解析为未引用', () => {
    mocks.safeLocalStorageGet.mockReturnValue('false');

    expect(
      getStoredReferenceState({
        projectId: ' project-1 ',
        kbId: ' kb-1 ',
        docId: ' doc-1 ',
      })
    ).toBe(false);
    expect(mocks.safeLocalStorageGet).toHaveBeenCalledWith(storageKey);
  });

  it('setStoredReferenceState 会在引用开启时清理存储，否则写入 false', () => {
    mocks.safeLocalStorageRemove.mockReturnValue(true);
    mocks.safeLocalStorageSet.mockReturnValue(true);

    expect(
      setStoredReferenceState(
        {
          projectId: 'project-1',
          kbId: 'kb-1',
          docId: 'doc-1',
        },
        true
      )
    ).toBe(true);
    expect(mocks.safeLocalStorageRemove).toHaveBeenCalledWith(storageKey);

    expect(
      setStoredReferenceState(
        {
          projectId: 'project-1',
          kbId: 'kb-1',
          docId: 'doc-1',
        },
        false
      )
    ).toBe(true);
    expect(mocks.safeLocalStorageSet).toHaveBeenCalledWith(storageKey, 'false');
  });

  it('clearStoredReferenceState 会在 key 完整时删除存储', () => {
    mocks.safeLocalStorageRemove.mockReturnValue(true);

    expect(
      clearStoredReferenceState({
        projectId: 'project-1',
        kbId: 'kb-1',
        docId: 'doc-1',
      })
    ).toBe(true);
    expect(mocks.safeLocalStorageRemove).toHaveBeenCalledWith(storageKey);
  });

  it('resolveDocReferenceState 仅对 DONE 状态读取存储结果', () => {
    mocks.safeLocalStorageGet.mockReturnValue(null);

    expect(
      resolveDocReferenceState({
        projectId: 'project-1',
        kbId: 'kb-1',
        docId: 'doc-1',
        status: 'PROCESSING',
      })
    ).toBe(false);
    expect(
      resolveDocReferenceState({
        projectId: 'project-1',
        kbId: 'kb-1',
        docId: 'doc-1',
        status: 'DONE',
      })
    ).toBe(true);
  });
});
