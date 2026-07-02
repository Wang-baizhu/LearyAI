// usePreviewJump.test.ts 负责验证预览跳转参数解析与 URL 清理行为。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: { pathname: '/resource/detail', state: { from: 'test' } },
  searchParams: new URLSearchParams('page=12&jump=34&keyword=ai'),
}));

vi.mock('react', () => ({
  useCallback: (fn: unknown) => fn,
  useMemo: (factory: () => unknown) => factory(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  useLocation: () => mocks.location,
  useSearchParams: () => [mocks.searchParams],
}));

import { usePreviewJump } from '../../usePreviewJump';

describe('usePreviewJump', () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
  });

  it('会解析 page 和 jump 参数', () => {
    const result = usePreviewJump();
    expect(result.jumpToPage).toBe(12);
    expect(result.jumpToken).toBe(34);
  });

  it('会在处理完成后移除 page/jump 并保留其他参数和 location.state', () => {
    const result = usePreviewJump();
    result.onJumpHandled();

    expect(mocks.navigate).toHaveBeenCalledWith('/resource/detail?keyword=ai', {
      replace: true,
      state: { from: 'test' },
    });
  });

  it('参数非法时会返回 undefined，且没有跳转参数时不会导航', () => {
    mocks.searchParams = new URLSearchParams('page=NaN&foo=bar');
    const result = usePreviewJump();

    expect(result.jumpToPage).toBeUndefined();
    expect(result.jumpToken).toBeUndefined();

    mocks.searchParams = new URLSearchParams('foo=bar');
    usePreviewJump().onJumpHandled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});
