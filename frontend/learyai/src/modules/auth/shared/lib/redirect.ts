// redirect 负责收口登录页来源跳转的构造与安全解析逻辑。
export interface AuthRedirectLocationLike {
  pathname: string;
  search: string;
  hash: string;
}

export const DEFAULT_POST_AUTH_REDIRECT = '/workspace';

const isSafeRelativeRedirect = (value: string) => value.startsWith('/') && !value.startsWith('//');

export const buildLoginRedirectPath = (
  location: AuthRedirectLocationLike,
  loginPath = '/',
) => {
  const redirectTarget = `${location.pathname}${location.search}${location.hash}`;
  const params = new URLSearchParams({
    redirect: redirectTarget,
  });
  return `${loginPath}?${params.toString()}`;
};

export const resolveAuthRedirectTarget = (
  rawRedirect: string | null | undefined,
  fallback = DEFAULT_POST_AUTH_REDIRECT,
) => {
  if (!rawRedirect) {
    return fallback;
  }

  if (isSafeRelativeRedirect(rawRedirect) && rawRedirect !== '/') {
    return rawRedirect;
  }

  return fallback;
};
