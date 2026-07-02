// reference 负责转换资源数据为 Sidebar 可用结构并处理引用匹配。
import type { RootState } from '@/app/store';
import type { ResourceFileKind, ResourceListItem, SidebarResource } from '@/modules/kbdoc';
import { buildReferenceScopeKey, type ReferenceResource, type ReferenceScopeContext } from '../store/slice';

const EMPTY_REFERENCED_RESOURCES: ReferenceResource[] = [];

const resolveIcon = (fileType: ResourceFileKind) => {
  switch (fileType) {
    case 'pdf':
      return 'picture_as_pdf';
    case 'docx':
      return 'description';
    case 'pptx':
      return 'slideshow';
    case 'md':
      return 'markdown';
    case 'url':
      return 'link';
    case 'wav':
    case 'mp3':
    case 'm4a':
    case 'aac':
    case 'flac':
    case 'ogg':
      return 'audio_file';
    default:
      return 'insert_drive_file';
  }
};

export const mapListItemToReference = (item: ResourceListItem): ReferenceResource => ({
  id: item.docId,
  docId: item.docId,
  name: item.name,
  fileType: item.fileType,
  previewUrl: item.previewUrl ?? null,
});

export const mapReferenceToSidebarResource = (ref: ReferenceResource): SidebarResource => ({
  id: ref.docId,
  code: ref.docId,
  title: ref.name,
  description: ref.docId,
  type: 'DOC',
  icon: resolveIcon(ref.fileType),
  category: ref.fileType.toUpperCase(),
  status: undefined,
  file: {
    kind: ref.fileType,
    name: ref.name,
    url: ref.previewUrl ?? undefined,
  },
});

export const mapListItemToSidebarResource = (item: ResourceListItem): SidebarResource => ({
  ...mapReferenceToSidebarResource(mapListItemToReference(item)),
  status: item.status,
});

export const findReferenceBySource = (
  source: string,
  refs: ReferenceResource[]
): ReferenceResource | null => {
  const normalized = source.trim().toLowerCase();

  for (const ref of refs) {
    if (ref.docId.trim().toLowerCase() === normalized) {
      return ref;
    }
  }

  return null;
};

export const selectReferencedResourcesByContext = (
  state: RootState,
  context?: ReferenceScopeContext
): ReferenceResource[] => {
  const scopeKey = buildReferenceScopeKey(context);
  if (!scopeKey) {
    return EMPTY_REFERENCED_RESOURCES;
  }
  return state.resourceCenter.referencedResourcesByContext[scopeKey] ?? EMPTY_REFERENCED_RESOURCES;
};
