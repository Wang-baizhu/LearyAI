// 责任：管理管理员任务 DLQ 事故记录查询与写操作的 React Query 状态。
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { taskDlqApi, type TaskDlqIncidentListParams } from '../api/taskDlq.api';

const TASK_DLQ_QUERY_KEY = ['task-dlq', 'list'] as const;

export function useTaskDlqIncidentList(params: TaskDlqIncidentListParams) {
  const page = params.page ?? 0;
  const size = params.size ?? 20;
  const query = useQuery({
    queryKey: [...TASK_DLQ_QUERY_KEY, { ...params, page, size }],
    queryFn: () => taskDlqApi.list({ ...params, page, size }),
    enabled: page >= 0 && size >= 1 && size <= 100,
  });

  return {
    ...query,
    pageData: query.data?.data,
  };
}

export function useUpdateTaskDlqIncidentStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ incidentId, incidentStatus }: { incidentId: number; incidentStatus: 'OPEN' | 'RESOLVED' | 'IGNORED' }) =>
      taskDlqApi.updateStatus(incidentId, { incidentStatus }),
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: TASK_DLQ_QUERY_KEY });
      if (response.data?.incidentId !== undefined) {
        void queryClient.invalidateQueries({ queryKey: ['task-dlq', 'detail', response.data.incidentId] });
      }
    },
  });
}

export function useDeleteTaskDlqIncident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: taskDlqApi.remove,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: TASK_DLQ_QUERY_KEY });
    },
  });
}
