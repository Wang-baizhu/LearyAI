// mapSessionSummary 负责把 session:list 条目映射为前端会话摘要。
import type { AgentSessionSummary } from '../../../entities';
import type { SessionListPayload } from '../model/types';

export const mapSessionSummary = (
  payload: SessionListPayload['sessions'][number]
): AgentSessionSummary => ({
  id: payload.agentSessionId,
  name: payload.name ?? '未命名会话',
  kbId: payload.kbId?.trim() ? payload.kbId.trim() : null,
  updatedAt: payload.updatedAt ?? new Date().toISOString(),
  sessionType: payload.sessionType ?? 'main',
  parentSessionId: payload.parentSessionId?.trim() ? payload.parentSessionId.trim() : null,
  subagentType: payload.subagentType?.trim() ? payload.subagentType.trim() : null,
  status: (payload.status ?? null) as AgentSessionSummary['status'],
  messageCount: 0,
  referenceCount: 0,
  isStreaming: payload.isStreaming ?? false,
  pendingPermissionCount: payload.pendingPermissionCount ?? 0,
  pendingQuestionCount: payload.pendingQuestionCount ?? 0,
});
