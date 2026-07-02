// detailOpen 负责收敛资源中心详情打开协议与便捷调用函数。
import type { ResourceCenterDetailKind, ResourceCenterDetailTabKey } from '../model/types/panel';

export interface ResourceCenterDetailOpenPayload {
  docId: string;
  label?: string;
  kind: ResourceCenterDetailKind;
  templateId?: string;
  jumpToPage?: number;
  jumpToken?: number;
  pageText?: string;
  autoMergeToActiveGroup?: boolean;
  mergeTargetKey?: ResourceCenterDetailTabKey;
}

export type ResourceCenterDetailOpenHandler = (payload: ResourceCenterDetailOpenPayload) => void;

export const openResourceCenterDetail = (
  handler: ResourceCenterDetailOpenHandler | undefined,
  payload: ResourceCenterDetailOpenPayload,
) => {
  if (!handler) return;
  handler(payload);
};

export const openResourceCenterResourceDetail = (
  handler: ResourceCenterDetailOpenHandler | undefined,
  payload: Omit<ResourceCenterDetailOpenPayload, 'kind'>,
) => {
  openResourceCenterDetail(handler, { ...payload, kind: 'kbdoc' });
};

export const openResourceCenterTemplateDetail = (
  handler: ResourceCenterDetailOpenHandler | undefined,
  payload: Omit<ResourceCenterDetailOpenPayload, 'kind'>,
) => {
  openResourceCenterDetail(handler, { ...payload, kind: 'template' });
};

export const openResourceCenterVideoDetail = (
  handler: ResourceCenterDetailOpenHandler | undefined,
  payload: Omit<ResourceCenterDetailOpenPayload, 'kind'>,
) => {
  openResourceCenterDetail(handler, { ...payload, kind: 'video' });
};
