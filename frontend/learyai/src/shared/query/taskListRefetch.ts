// taskListRefetch 负责按 projectId + kbId 作用域主动刷新当前激活的任务列表查询。
import { queryClient } from './queryClient';

const shouldMatchScope = (scopeValue: string | undefined, queryValue: unknown) => {
  if (!scopeValue) {
    return true;
  }
  return typeof queryValue === 'string' && queryValue === scopeValue;
};

export const refetchActiveTaskList = (projectId?: string, kbId?: string) =>
  queryClient.refetchQueries({
    predicate: (query) => {
      const key = query.queryKey;
      if (key[0] !== 'task' || key[1] !== 'list') {
        return false;
      }
      const params = key[2] as Record<string, unknown> | undefined;
      return shouldMatchScope(projectId, params?.projectId) && shouldMatchScope(kbId, params?.kbId);
    },
    type: 'active',
  });
