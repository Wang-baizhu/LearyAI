// reference.test.ts 负责验证资源中心引用选择器与映射逻辑。
import { describe, expect, it } from 'vitest';
import {
  findReferenceBySource,
  mapListItemToReference,
  mapListItemToSidebarResource,
  mapReferenceToSidebarResource,
} from '../reference';

describe('resource reference selectors', () => {
  it('会把列表项映射为引用对象与侧栏对象', () => {
    const item = {
      docId: 'doc-1',
      name: '设计文档',
      fileType: 'pdf' as const,
      size: 1,
      previewUrl: 'https://example.com/doc-1.pdf',
      createdAt: '2026-03-29T00:00:00.000Z',
      status: 'DONE' as const,
    };

    const reference = mapListItemToReference(item);
    expect(reference).toEqual({
      id: 'doc-1',
      docId: 'doc-1',
      name: '设计文档',
      fileType: 'pdf',
      previewUrl: 'https://example.com/doc-1.pdf',
    });

    expect(mapReferenceToSidebarResource(reference)).toEqual({
      id: 'doc-1',
      code: 'doc-1',
      title: '设计文档',
      description: 'doc-1',
      type: 'DOC',
      icon: 'picture_as_pdf',
      category: 'PDF',
      status: undefined,
      file: {
        kind: 'pdf',
        name: '设计文档',
        url: 'https://example.com/doc-1.pdf',
      },
    });

    expect(mapListItemToSidebarResource(item).status).toBe('DONE');
  });

  it('findReferenceBySource 会忽略大小写和首尾空格', () => {
    expect(
      findReferenceBySource('  DOC-1 ', [
        {
          id: '1',
          docId: 'doc-1',
          name: '设计文档',
          fileType: 'pdf',
          previewUrl: null,
        },
      ])
    )?.toMatchObject({ docId: 'doc-1' });

    expect(findReferenceBySource('doc-2', [])).toBeNull();
  });

  it('会为音频资源生成 audio_file 图标', () => {
    expect(
      mapReferenceToSidebarResource({
        id: '2',
        docId: 'doc-2',
        name: '会议录音',
        fileType: 'mp3',
        previewUrl: null,
      }).icon
    ).toBe('audio_file');
  });

  it('会为链接资源生成 link 图标', () => {
    expect(
      mapReferenceToSidebarResource({
        id: '3',
        docId: 'doc-3',
        name: '网页链接',
        fileType: 'url',
        previewUrl: null,
      }).icon
    ).toBe('link');
  });
});
