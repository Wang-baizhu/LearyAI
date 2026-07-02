// video.ts 负责把资源 originUrl 解析为可嵌入的视频预览地址。
export interface VideoEmbedConfig {
  provider: 'bilibili';
  title: string;
  embedUrl: string;
  originUrl: string;
}

const BILIBILI_HOSTS = new Set([
  'www.bilibili.com',
  'bilibili.com',
  'player.bilibili.com',
]);

const resolveBilibiliIdentity = (url: URL) => {
  const pathnameSegments = url.pathname.split('/').filter(Boolean);
  const bvidFromPath = pathnameSegments.find((segment) => /^BV[0-9A-Za-z]+$/i.test(segment));
  const bvidFromQuery = url.searchParams.get('bvid');
  const bvid = (bvidFromPath ?? bvidFromQuery ?? '').trim();
  if (!bvid) {
    return null;
  }

  const pageValue = Number(url.searchParams.get('p') ?? '1');
  const page = Number.isFinite(pageValue) && pageValue > 0 ? Math.floor(pageValue) : 1;
  return { bvid, page };
};

export const resolveVideoEmbedConfig = (
  originUrl?: string | null,
  startSeconds = 0
): VideoEmbedConfig | null => {
  const normalizedOriginUrl = originUrl?.trim();
  if (!normalizedOriginUrl) {
    return null;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(normalizedOriginUrl);
  } catch {
    return null;
  }

  if (!BILIBILI_HOSTS.has(parsedUrl.hostname)) {
    return null;
  }

  const identity = resolveBilibiliIdentity(parsedUrl);
  if (!identity) {
    return null;
  }

  const embedUrl = new URL('https://player.bilibili.com/player.html');
  embedUrl.searchParams.set('bvid', identity.bvid);
  embedUrl.searchParams.set('p', String(identity.page));
  if (startSeconds > 0) {
    embedUrl.searchParams.set('t', String(Math.floor(startSeconds)));
  }

  return {
    provider: 'bilibili',
    title: 'B站视频预览',
    embedUrl: embedUrl.toString(),
    originUrl: normalizedOriginUrl,
  };
};
