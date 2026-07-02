// imagePreviewViewportPosition 负责计算图片预览视口中的当前页与跳转目标位置。
import {
  findNearestPreviewItemNumber,
  PREVIEW_VIEWPORT_TOP_OFFSET,
  resolvePreviewItemTop,
} from './previewViewportPosition';

export const IMAGE_PREVIEW_VIEWPORT_TOP_OFFSET = PREVIEW_VIEWPORT_TOP_OFFSET;

export const findNearestPreviewPageNumber = (
  container: HTMLElement,
  topOffset = IMAGE_PREVIEW_VIEWPORT_TOP_OFFSET
) => findNearestPreviewItemNumber(container, 'pageNumber', topOffset);

export const resolvePreviewPageTop = (
  targetElement: HTMLElement,
  topOffset = IMAGE_PREVIEW_VIEWPORT_TOP_OFFSET
) => resolvePreviewItemTop(targetElement, topOffset);
