// features/connect/lib/agentQuery 负责提交 AI Chat query HTTP 请求。
import type { ContentBlock, DocReference } from '../../../entities';
import { buildAgentQueryUrl } from '../../../shared/api';

export interface SubmitAgentQueryPayload {
  agentSessionId: string;
  subagentId?: string;
  requestId: string;
  prompt: ContentBlock[];
  docRefs?: DocReference[];
  customPrompt?: string;
  projectId?: string;
  kbId?: string;
  model_config_type?: string;
}

export interface SubmitAgentQueryResponse {
  queryId: string;
  agentSessionId: string;
  status: 'accepted';
}

export class AgentQueryApiError extends Error {
  status?: number;
  code?: string;

  constructor(message: string, options?: { status?: number; code?: string }) {
    super(message);
    this.name = 'AgentQueryApiError';
    this.status = options?.status;
    this.code = options?.code;
  }
}

const normalizeBody = (payload: SubmitAgentQueryPayload) => ({
  agentSessionId: payload.agentSessionId,
  subagentId: payload.subagentId,
  requestId: payload.requestId,
  prompt: payload.prompt,
  docRefs: payload.docRefs,
  custom_prompt: payload.customPrompt,
  projectId: payload.projectId,
  kbId: payload.kbId,
  model_config_type: payload.model_config_type ?? 'default',
});

export const submitAgentQuery = async (
  payload: SubmitAgentQueryPayload,
): Promise<SubmitAgentQueryResponse> => {
  const response = await fetch(buildAgentQueryUrl(), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(normalizeBody(payload)),
  });
  const raw = (await response.json().catch(() => null)) as
    | SubmitAgentQueryResponse
    | { detail?: { code?: string; message?: string } }
    | null;
  if (!response.ok) {
    const detail = raw && 'detail' in raw ? raw.detail : undefined;
    throw new AgentQueryApiError(detail?.message ?? '请求失败', {
      status: response.status,
      code: detail?.code,
    });
  }
  if (!raw || !('queryId' in raw) || !('agentSessionId' in raw) || raw.status !== 'accepted') {
    throw new AgentQueryApiError('响应格式不正确', { status: response.status });
  }
  return raw;
};
