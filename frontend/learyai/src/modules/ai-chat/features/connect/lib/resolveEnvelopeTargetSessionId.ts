// resolveEnvelopeTargetSessionId 负责把 WS envelope/meta 映射为前端 store 使用的真实 target sessionId。
import type { AgentWsRuntimeEnvelope } from '../../../shared/api/agentWs';

export const resolveTargetSessionId = ({
  agentSessionId,
  subagentId,
}: {
  agentSessionId?: string | null;
  subagentId?: string | null;
}) => {
  if (!agentSessionId) {
    return null;
  }
  if (subagentId?.trim()) {
    return subagentId.trim();
  }
  return agentSessionId;
};

export const resolveEnvelopeTargetSessionId = (envelope: AgentWsRuntimeEnvelope) =>
  resolveTargetSessionId({
    agentSessionId:
      envelope.meta?.agentSessionId ??
      ((envelope.payload as { agentSessionId?: string } | undefined)?.agentSessionId ?? null),
    subagentId:
      envelope.meta?.subagentId ??
      ((envelope.payload as { subagentId?: string } | undefined)?.subagentId ?? null),
  });
