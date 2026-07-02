// agentWsNormalizer 负责把 WS 原始协议消息收敛为前端内部统一的 envelope 结构。
import type { AgentWsEvent, AgentWsRuntimeEnvelope } from '../../../shared/api/agentWs';
import type {
  AgentWsMessagesUpdatedPayload,
  AgentWsSessionContextPayload,
  AgentWsSessionSubagentContextPayload,
  AgentWsWireBlock,
} from '../../../shared/api';

type NormalizedEnvelope = AgentWsRuntimeEnvelope;

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeMeta = (meta: unknown): AgentWsEvent['meta'] | undefined => {
  if (!isObjectRecord(meta)) return undefined;
  const rawUserId =
    typeof meta.userId === 'string'
      ? meta.userId
      : typeof meta.user_id === 'string'
      ? meta.user_id
      : undefined;
  const parsedUserId =
    rawUserId && rawUserId.trim() && !Number.isNaN(Number(rawUserId)) ? Number(rawUserId) : undefined;
  return {
    agentSessionId:
      typeof meta.agentSessionId === 'string'
        ? meta.agentSessionId
        : typeof meta.agent_session_id === 'string'
        ? meta.agent_session_id
        : undefined,
    subagentId:
      typeof meta.subagentId === 'string'
        ? meta.subagentId
        : typeof meta.subagent_id === 'string'
        ? meta.subagent_id
        : undefined,
    traceId: typeof meta.traceId === 'string' ? meta.traceId : undefined,
    userId: parsedUserId,
  };
};

const parseWireBlockPayload = (block: AgentWsWireBlock | Record<string, unknown>) => {
  if (!isObjectRecord(block)) return block;
  if (isObjectRecord(block.payload)) return block;
  const payloadJson = typeof block.payload_json === 'string' ? block.payload_json : undefined;
  if (!payloadJson) return block;
  try {
    return {
      ...block,
      payload: JSON.parse(payloadJson) as Record<string, unknown>,
    };
  } catch {
    return block;
  }
};

const normalizeWireBlocks = (blocks: unknown) => {
  if (!Array.isArray(blocks)) return blocks;
  return blocks.map((block) => parseWireBlockPayload(block as AgentWsWireBlock));
};

const normalizePayloadByAction = (action: string | undefined, payload: unknown) => {
  if (!action || !isObjectRecord(payload)) return payload;
  if (action === 'session:context') {
    const sessionPayload = payload as AgentWsSessionContextPayload & Record<string, unknown>;
    return {
      ...sessionPayload,
      blocks: normalizeWireBlocks(sessionPayload.blocks),
    };
  }
  if (action === 'session:subagent_context') {
    const subagentPayload = payload as AgentWsSessionSubagentContextPayload &
      Record<string, unknown>;
    return {
      ...subagentPayload,
      blocks: normalizeWireBlocks(subagentPayload.blocks),
    };
  }
  if (action === 'messages:updated') {
    const updatePayload = payload as AgentWsMessagesUpdatedPayload & Record<string, unknown>;
    return {
      ...updatePayload,
      blocks: normalizeWireBlocks(updatePayload.blocks),
    };
  }
  return payload;
};

export const normalizeAgentWsEnvelope = (rawEnvelope: unknown): NormalizedEnvelope | null => {
  if (!isObjectRecord(rawEnvelope)) return null;

  const action =
    typeof rawEnvelope.cmd === 'string'
      ? rawEnvelope.cmd
      : typeof rawEnvelope.event === 'string'
      ? rawEnvelope.event
      : undefined;

  if (!action) return null;

  return {
    ...(typeof rawEnvelope.cmd === 'string'
      ? { cmd: rawEnvelope.cmd }
      : typeof rawEnvelope.event === 'string'
      ? { event: rawEnvelope.event }
      : {}),
    payload: normalizePayloadByAction(action, rawEnvelope.payload),
    meta: normalizeMeta(rawEnvelope.meta),
  };
};
