// previewViewportPosition 负责计算预览视口中的当前项序号与跳转目标位置。

export const PREVIEW_VIEWPORT_TOP_OFFSET = 24;

const resolvePreviewDataSelector = (dataAttribute: string) => dataAttribute
  .replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`)
  .replace(/^/, 'data-');

export const findNearestPreviewItemNumber = (
  container: HTMLElement,
  dataAttribute: string,
  topOffset = PREVIEW_VIEWPORT_TOP_OFFSET
) => {
  const itemElements = Array.from(
    container.querySelectorAll<HTMLElement>(`[${resolvePreviewDataSelector(dataAttribute)}]`)
  );
  if (itemElements.length === 0) {
    return null;
  }

  let nearestItemNumber = Number(itemElements[0].dataset[dataAttribute]);
  let nearestDistance = Number.POSITIVE_INFINITY;
  itemElements.forEach((element) => {
    const itemNumber = Number(element.dataset[dataAttribute]);
    const distance = Math.abs(element.offsetTop - container.scrollTop - topOffset);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestItemNumber = itemNumber;
    }
  });

  return nearestItemNumber;
};

export const resolvePreviewItemTop = (
  targetElement: HTMLElement,
  topOffset = PREVIEW_VIEWPORT_TOP_OFFSET
) => Math.max(0, targetElement.offsetTop - topOffset);
