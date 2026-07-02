// ResourceVideoDetail.test.tsx 负责验证视频详情页对跨 tab 跳转请求的消费。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useAppDispatch: vi.fn(),
  useAppSelector: vi.fn(),
  MaterialIcon: vi.fn(({ name }: any) => <span data-icon={name} />),
  resolveVideoEmbedConfig: vi.fn(),
  clearVideoJumpRequest: vi.fn((payload: any) => ({ type: 'resource/clearVideoJumpRequest', payload })),
}));

vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  const actualReact = actual as typeof React;
  const mockedReact = {
    ...actualReact,
    useEffect: (effect: () => void | (() => void)) => effect(),
  };
  return {
    ...mockedReact,
    default: mockedReact,
  };
});

vi.mock('@/app/store/hooks', () => ({
  useAppDispatch: mocks.useAppDispatch,
  useAppSelector: mocks.useAppSelector,
}));

vi.mock('@/shared/ui/icons/MaterialIcon', () => ({
  default: mocks.MaterialIcon,
}));

vi.mock('../../lib/video', () => ({
  resolveVideoEmbedConfig: mocks.resolveVideoEmbedConfig,
}));

vi.mock('@/modules/resource', () => ({
  clearVideoJumpRequest: mocks.clearVideoJumpRequest,
}));

import ResourceVideoDetail from '../ResourceVideoDetail';

describe('ResourceVideoDetail', () => {
  beforeEach(() => {
    mocks.useAppDispatch.mockReset();
    mocks.useAppSelector.mockReset();
    mocks.MaterialIcon.mockClear();
    mocks.resolveVideoEmbedConfig.mockReset();
    mocks.clearVideoJumpRequest.mockClear();

    mocks.useAppDispatch.mockReturnValue(vi.fn());
    mocks.useAppSelector.mockImplementation((selector: (state: any) => unknown) =>
      selector({
        resourceCenter: {
          videoJumpRequest: null,
        },
      })
    );
    mocks.resolveVideoEmbedConfig.mockReturnValue({
      title: 'B站视频预览',
      originUrl: 'https://www.bilibili.com/video/BV1rRM2z6EW6?p=1',
      embedUrl: 'https://player.bilibili.com/player.html?bvid=BV1rRM2z6EW6&p=1',
    });
  });

  it('renders video embed config for url resources', () => {
    const html = renderToStaticMarkup(
      <ResourceVideoDetail
        resource={{
          docId: 'doc-video-1',
          name: '课程视频',
          fileType: 'url',
          originUrl: 'https://www.bilibili.com/video/BV1rRM2z6EW6?p=1',
        } as any}
      />
    );

    expect(html).toContain('课程视频');
    expect(html).toContain('视频详情');
    expect(html).toContain('B站视频预览');
    expect(mocks.resolveVideoEmbedConfig).toHaveBeenCalledWith(
      'https://www.bilibili.com/video/BV1rRM2z6EW6?p=1',
      0
    );
  });

  it('consumes matching redux video jump request and clears it after handling', () => {
    const dispatch = vi.fn();
    mocks.useAppDispatch.mockReturnValue(dispatch);
    mocks.useAppSelector.mockImplementation((selector: (state: any) => unknown) =>
      selector({
        resourceCenter: {
          videoJumpRequest: {
            docId: 'doc-video-1',
            startSeconds: 7,
            token: 321,
          },
        },
      })
    );

    renderToStaticMarkup(
      <ResourceVideoDetail
        resource={{
          docId: 'doc-video-1',
          name: '课程视频',
          fileType: 'url',
          originUrl: 'https://www.bilibili.com/video/BV1rRM2z6EW6?p=1',
        } as any}
      />
    );

    expect(mocks.clearVideoJumpRequest).toHaveBeenCalledWith({ token: 321 });
    expect(dispatch).toHaveBeenCalledWith({
      type: 'resource/clearVideoJumpRequest',
      payload: {
        token: 321,
      },
    });
  });
});
