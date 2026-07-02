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
    importUrl: vi.fn(),
  },
}));

vi.mock('@/shared/ui/icons/MaterialIcon', () => ({
  default: mocks.MaterialIcon,
}));

import ResourceImportUrlModal from '../ResourceImportUrlModal';

describe('ResourceImportUrlModal', () => {
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
          isImportUrlOpen: false,
        },
      })
    );

    const html = renderToStaticMarkup(<ResourceImportUrlModal projectId="project-1" />);

    expect(html).toBe('');
  });

  it('renders the idle import dialog when opened', () => {
    mocks.useAppSelector.mockImplementation((selector: (state: any) => unknown) =>
      selector({
        resourceCenter: {
          isImportUrlOpen: true,
        },
      })
    );

    const html = renderToStaticMarkup(<ResourceImportUrlModal projectId="project-1" />);

    expect(html).toContain('导入链接');
    expect(html).toContain('请输入 https://www.bilibili.com/video 开头的 B 站视频链接');
    expect(html).toContain('开始导入');
    expect(html).toContain('当前仅支持 B 站视频链接');
  });

  it('renders the pending state when the mutation is pending', () => {
    mocks.useAppSelector.mockImplementation((selector: (state: any) => unknown) =>
      selector({
        resourceCenter: {
          isImportUrlOpen: true,
        },
      })
    );
    mocks.useMutation.mockReturnValue({
      isPending: true,
      mutate: vi.fn(),
    });

    const html = renderToStaticMarkup(<ResourceImportUrlModal projectId="project-1" />);

    expect(html).toContain('导入中...');
  });
});
