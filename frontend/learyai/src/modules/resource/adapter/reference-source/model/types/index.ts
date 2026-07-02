// reference source types 负责定义资源中心引用来源适配层的内部契约。
import type { ResourceListItem } from '@/modules/kbdoc';
import type { ReferenceResource } from '../../../../entities/resource-center';

export type ReferenceSourceItem = ResourceListItem;
export type ReferenceSourceTarget = ReferenceResource;
