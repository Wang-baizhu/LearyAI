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
    prepareUpload: vi.fn(),
    confirmUpload: vi.fn(),
  },
  resolveUploadContentType: vi.fn(),
  resolveUploadTempUrl: vi.fn(),
}));

vi.mock('../../../../shared/api', () => ({
  uploadToTempUrl: vi.fn(),
}));

vi.mock('@/shared/ui/icons/MaterialIcon', () => ({
  default: mocks.MaterialIcon,
}));

import ResourceImportModal from '../ResourceImportModal';

describe('ResourceImportModal', () => {
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
          isImportOpen: false,
        },
      })
    );

    const html = renderToStaticMarkup(<ResourceImportModal projectId="project-1" />);

    expect(html).toBe('');
  });

  it('renders the idle upload dialog when opened', () => {
    mocks.useAppSelector.mockImplementation((selector: (state: any) => unknown) =>
      selector({
        resourceCenter: {
          isImportOpen: true,
        },
      })
    );

    const html = renderToStaticMarkup(<ResourceImportModal projectId="project-1" />);

    expect(html).toContain('导入文档');
    expect(html).toContain('支持 PDF / DOCX / PPTX / MD / TXT / WAV / MP3 / M4A / AAC / FLAC / OGG');
    expect(html).toContain('点击选择或拖拽文件到此处');
    expect(html).toContain('开始上传');
  });

  it('renders the uploading state when the mutation is pending', () => {
    mocks.useAppSelector.mockImplementation((selector: (state: any) => unknown) =>
      selector({
        resourceCenter: {
          isImportOpen: true,
        },
      })
    );
    mocks.useMutation.mockReturnValue({
      isPending: true,
      mutate: vi.fn(),
    });

    const html = renderToStaticMarkup(<ResourceImportModal projectId="project-1" />);

    expect(html).toContain('上传进度');
    expect(html).toContain('上传中...');
  });
});
