// resourceDetail 负责收敛资源详情页的纯计算规则。
import { parseDocumentationTree, type DocumentationTree, type ResourceDetail } from '../../../entities/resource';

export const TEXT_PREVIEWABLE_TYPES = new Set(['md', 'txt', 'url', 'wav', 'mp3', 'm4a', 'aac', 'flac', 'ogg']);

export const VIEWER_PAGE_HEIGHT_CLASS = 'h-[34rem] sm:h-[44rem] lg:h-[62rem]';

export const normalizeDocumentationTree = (documentation: ResourceDetail['metadata'] extends infer Metadata
  ? Metadata extends { documentation?: infer Value }
    ? Value | undefined
    : never
  : never): DocumentationTree | null => (documentation ? parseDocumentationTree(documentation) : null);

export const formatResourceMeta = (resource: ResourceDetail): string => {
  const parts = [resource.createdAt];
  if (typeof resource.size === 'number' && Number.isFinite(resource.size) && resource.size > 0) {
    const sizeInMb = resource.size / (1024 * 1024);
    parts.push(`${sizeInMb >= 1 ? sizeInMb.toFixed(1) : (resource.size / 1024).toFixed(0)} ${sizeInMb >= 1 ? 'MB' : 'KB'}`);
  }
  return parts.join(' • ');
};

export const resolvePageStart = (pageValue: string): number | undefined => {
  const firstPage = Number(pageValue.split('-')[0]?.trim());
  if (!Number.isFinite(firstPage) || firstPage < 1) {
    return undefined;
  }
  return firstPage;
};
