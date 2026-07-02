import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useParams: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(),
  useAppDispatch: vi.fn(),
  useAppSelector: vi.fn(),
  closeImport: vi.fn(() => ({ type: 'resourceCenter/closeImport' })),
  MaterialIcon: vi.fn(({ name }: any) => <span data-icon={name} />),
}));

vi.mock('react-router-dom', () => ({
  useParams: mocks.useParams,
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: mocks.useMutation,
  useQueryClient: mocks.useQueryClient,
}));

vi.mock('@/app/store/hooks', () => ({
  useAppDispatch: mocks.useAppDispatch,
  useAppSelector: mocks.useAppSelector,
}));

vi.mock('../../../../../resource', () => ({
  closeImport: mocks.closeImport,
}));

vi.mock('../../../../entities/resource', () => ({
  resourceApi: {
    importText: vi.fn(),
  },
}));

vi.mock('@/shared/ui/icons/MaterialIcon', () => ({
  default: mocks.MaterialIcon,
}));

import ResourceImportTextModal from '../ResourceImportTextModal';

describe('ResourceImportTextModal', () => {
  beforeEach(() => {
    mocks.useParams.mockReset();
    mocks.useMutation.mockReset();
    mocks.useQueryClient.mockReset();
    mocks.useAppDispatch.mockReset();
    mocks.useAppSelector.mockReset();

    mocks.useParams.mockReturnValue({ kbId: 'kb-1' });
    mocks.useQueryClient.mockReturnValue({
      invalidateQueries: vi.fn(),
    });
    mocks.useAppDispatch.mockReturnValue(vi.fn());
    mocks.useMutation.mockReturnValue({
      isPending: false,
      mutate: vi.fn(),
    });
  });

  it('returns null markup when the modal is closed', () => {
    mocks.useAppSelector.mockImplementation((selector: (state: any) => unknown) =>
      selector({
        resourceCenter: {
          isImportTextOpen: false,
        },
      })
    );

    const html = renderToStaticMarkup(<ResourceImportTextModal projectId="project-1" />);

    expect(html).toBe('');
  });

  it('renders the idle import dialog when opened', () => {
    mocks.useAppSelector.mockImplementation((selector: (state: any) => unknown) =>
      selector({
        resourceCenter: {
          isImportTextOpen: true,
        },
      })
    );

    const html = renderToStaticMarkup(<ResourceImportTextModal projectId="project-1" />);

    expect(html).toContain('导入文本');
    expect(html).toContain('未填写名称时默认使用前五个字加 ...');
    expect(html).toContain('请输入或粘贴纯文本内容');
    expect(html).toContain('开始导入');
  });

  it('renders the pending state when the mutation is pending', () => {
    mocks.useAppSelector.mockImplementation((selector: (state: any) => unknown) =>
      selector({
        resourceCenter: {
          isImportTextOpen: true,
        },
      })
    );
    mocks.useMutation.mockReturnValue({
      isPending: true,
      mutate: vi.fn(),
    });

    const html = renderToStaticMarkup(<ResourceImportTextModal projectId="project-1" />);

    expect(html).toContain('导入中...');
  });
});
