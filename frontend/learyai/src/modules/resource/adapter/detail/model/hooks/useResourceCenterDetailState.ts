import { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAppSelector } from '@/app/store/hooks';
import {
  useImagePreviewPagination,
  useResourceDetailByDocId,
  useTextPreviewPagination,
} from '@/modules/kbdoc';
import { usePreviewJump } from '../../../../entities/resource-detail';
import {
  selectScopedDocNameMap,
  type ResourceDetailPanelProps,
} from '../../../../entities/resource-center';

interface ResourceDetailPanelOutletContext {
  referencedDocRefs: { id: string; name?: string }[];
  fallbackDocRef: { id: string; name?: string } | null;
}

const PREVIEWABLE_TYPES = new Set(['pdf', 'pptx', 'docx']);
const TEXT_PREVIEW_TYPES = new Set(['md', 'txt', 'url', 'wav', 'mp3', 'm4a', 'aac', 'flac', 'ogg']);

export const useResourceCenterDetailState = ({
  docId,
  kbId,
  projectId,
  enableJump,
  detailKind,
  jumpToPage,
  jumpToken,
  onJumpHandled,
  localJump,
}: Pick<
  ResourceDetailPanelProps,
  'docId' | 'kbId' | 'projectId' | 'enableJump' | 'detailKind' | 'jumpToPage' | 'jumpToken' | 'onJumpHandled'
> & {
  localJump?: { docId: string; page: number; token: number } | null;
}) => {
  const docNameMap = useAppSelector((state) =>
    selectScopedDocNameMap(state, { projectId, kbId })
  );
  const outletContext = useOutletContext<ResourceDetailPanelOutletContext | null>();
  const referenceTitles = useMemo(() => {
    const map: Record<string, string> = {};
    Object.entries(docNameMap).forEach(([currentDocId, name]) => {
      const normalizedDocId = String(currentDocId ?? '').trim();
      const normalizedName = String(name ?? '').trim();
      if (!normalizedDocId || !normalizedName) return;
      map[normalizedDocId] = normalizedName;
    });
    if (Object.keys(map).length > 0 || !outletContext) {
      return map;
    }
    outletContext.referencedDocRefs.forEach((ref) => {
      if (ref.name) {
        map[String(ref.id)] = ref.name;
      }
    });
    if (outletContext.fallbackDocRef?.name) {
      map[String(outletContext.fallbackDocRef.id)] = outletContext.fallbackDocRef.name;
    }
    return map;
  }, [docNameMap, outletContext]);

  const isVideoDetail = detailKind === 'video';
  const detailDocId = docId ?? null;
  const detailQuery = useResourceDetailByDocId(detailDocId, kbId, projectId);
  const previewJump = usePreviewJump();
  const externalJump = enableJump && (jumpToPage != null || jumpToken != null || onJumpHandled)
    ? { jumpToPage, jumpToken, onJumpHandled }
    : enableJump
      ? previewJump
      : { jumpToPage: undefined, jumpToken: undefined, onJumpHandled: undefined };
  const resolvedJump = localJump && localJump.docId === detailDocId && (!externalJump.jumpToPage || localJump.token >= (externalJump.jumpToken ?? 0))
    ? { jumpToPage: localJump.page, jumpToken: localJump.token, onJumpHandled: externalJump.onJumpHandled }
    : externalJump;
  const isResourcePreviewDetail = !isVideoDetail;
  const isImagePreviewable = detailQuery.data ? PREVIEWABLE_TYPES.has(detailQuery.data.fileType) : false;
  const isTextPreviewable = detailQuery.data ? TEXT_PREVIEW_TYPES.has(detailQuery.data.fileType) : false;
  const previewPagination = useImagePreviewPagination(detailDocId, {
    enabled: isImagePreviewable && isResourcePreviewDetail,
    jumpToPage: resolvedJump.jumpToPage,
    jumpToken: resolvedJump.jumpToken,
    projectId,
  });
  const textPagination = useTextPreviewPagination(detailDocId, {
    enabled: isTextPreviewable && isResourcePreviewDetail,
    jumpToChunk: resolvedJump.jumpToPage,
    jumpToken: resolvedJump.jumpToken,
    projectId,
  });

  return {
    referenceTitles,
    isVideoDetail,
    detailQuery,
    resolvedJump,
    previewPagination,
    textPagination,
  };
};
