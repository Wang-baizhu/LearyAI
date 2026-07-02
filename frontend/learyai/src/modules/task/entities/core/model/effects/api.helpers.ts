// api.helpers 负责沉淀任务接口层的纯逻辑辅助函数，供运行时与单元测试复用。
import type { TaskListResponse } from '../types';

export const joinParam = (values?: string[]) =>
  values && values.length ? values.join(',') : undefined;

export const hasInProgressTask = (data?: TaskListResponse) =>
  Boolean(
    data?.items?.some(
      (item) =>
        item.status === 'UPLOADING' ||
        item.status === 'UPLOADED' ||
        item.status === 'PROCESSING'
    )
  );
