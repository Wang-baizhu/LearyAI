// useAiChatPermission 负责权限请求与响应流程。
import { useCallback } from 'react';
import { useAppDispatch } from '@/app/store/hooks';
import {
  addPendingPermission,
  resolveFirstPermission,
  resolvePermission,
} from '../../../../entities';
import type { PermissionRequest } from '../../../../entities';

type PermissionRequestPayload = PermissionRequest;

export const useAiChatPermission = () => {
  const dispatch = useAppDispatch();

  const handlePermissionRequest = useCallback(
    (payload: PermissionRequestPayload, agentSessionId?: string) => {
      if (!agentSessionId) return;
      dispatch(addPendingPermission({ agentSessionId, request: payload }));
    },
    [dispatch]
  );

  const handlePermissionAck = useCallback(
    (agentSessionId?: string, toolCallId?: string) => {
      if (!agentSessionId) return;
      if (toolCallId) {
        dispatch(resolvePermission({ agentSessionId, toolCallId }));
      } else {
        dispatch(resolveFirstPermission({ agentSessionId }));
      }
    },
    [dispatch]
  );

  const respondPermission = useCallback(
    (
      payload: {
        toolCallId: string;
        requestId?: string;
        decision: 'approve' | 'reject' | 'approve_for_session';
      },
      agentSessionId: string | null,
      sendEnvelope: (cmd: string, payload: unknown, agentSessionId?: string) => void
    ) => {
      if (!agentSessionId) return;
      sendEnvelope(
        'permission.respond',
        {
          agentSessionId,
          requestId: payload.requestId ?? payload.toolCallId,
          toolCallId: payload.toolCallId,
          decision: payload.decision,
        },
        agentSessionId
      );
    },
    []
  );

  return {
    handlePermissionRequest,
    handlePermissionAck,
    respondPermission,
  };
};
