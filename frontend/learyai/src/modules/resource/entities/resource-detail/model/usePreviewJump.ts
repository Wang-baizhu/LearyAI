// usePreviewJump 负责管理资源详情预览的跳转参数与锁定逻辑。
import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

const parseNumberParam = (value: string | null): number | undefined => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const usePreviewJump = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const jumpToPage = useMemo(
    () => parseNumberParam(searchParams.get('page')),
    [searchParams]
  );
  const jumpToken = useMemo(
    () => parseNumberParam(searchParams.get('jump')),
    [searchParams]
  );
  const handleJumpHandled = useCallback(() => {
    if (!searchParams.has('page') && !searchParams.has('jump')) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('page');
    nextParams.delete('jump');
    const nextSearch = nextParams.toString();
    const nextUrl = nextSearch ? `${location.pathname}?${nextSearch}` : location.pathname;
    navigate(nextUrl, { replace: true, state: location.state });
  }, [location.pathname, location.state, navigate, searchParams]);

  return {
    jumpToPage,
    jumpToken,
    onJumpHandled: handleJumpHandled,
  };
};
