// api 负责对接 KB skills token 签发接口，并基于 backend generated contract 约束请求与响应类型。
import { apiRequest } from '@/shared/api/client';
import type { ApiEnvelope, ApiReq, ApiRes } from '@/shared/api/contract';

export interface ResourceShareDocRef {
  id: string;
  name: string;
}

export interface ResourceShareTokenPayload {
  projectId: string;
  kbId: string;
  docRefs: ResourceShareDocRef[];
  abilities?: string[];
  expiresInDays?: number;
  neverExpires?: boolean;
}

export interface ResourceShareTokenResult {
  token: string;
  projectId: string;
  kbId: string;
  docRefs: ResourceShareDocRef[];
  abilities: string[];
  expiresAt: string | null;
}

type CreateKbSkillTokenApiBody = ApiReq<'/api/skills/kb/token', 'post'>;
type CreateKbSkillTokenApiData = NonNullable<ApiRes<'/api/skills/kb/token', 'post'>['data']>;
type CreateKbSkillTokenApiEnvelope = ApiEnvelope<CreateKbSkillTokenApiData>;

const DEFAULT_ABILITIES = ['search'];

const unwrapResponse = <T>(response: ApiEnvelope<T>) => response.data;

const normalizeDocRefs = (
  docRefs: CreateKbSkillTokenApiData['docRefs'] | undefined
): ResourceShareDocRef[] =>
  (docRefs ?? [])
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const raw = item as { id?: unknown; name?: unknown };
      const id = typeof raw.id === 'string' ? raw.id.trim() : '';
      const name = typeof raw.name === 'string' ? raw.name.trim() : '';
      if (!id || !name) return null;
      return { id, name };
    })
    .filter((item): item is ResourceShareDocRef => item !== null);

const normalizeTokenResult = (
  payload: CreateKbSkillTokenApiData | undefined
): ResourceShareTokenResult => {
  const token = payload?.token?.trim();
  const projectId = payload?.projectId?.trim();
  const kbId = payload?.kbId?.trim();
  if (!token || !projectId || !kbId) {
    throw new Error('分享 token 响应不完整，请稍后重试。');
  }
  return {
    token,
    projectId,
    kbId,
    docRefs: normalizeDocRefs(payload?.docRefs),
    abilities: (payload?.abilities ?? []).filter(
      (item): item is string => typeof item === 'string' && item.trim().length > 0
    ),
    expiresAt: payload?.expiresAt?.trim() ?? null,
  };
};

export const resourceShareTokenApi = {
  createToken: async (payload: ResourceShareTokenPayload): Promise<ResourceShareTokenResult> => {
    const body = {
      projectId: payload.projectId,
      kbId: payload.kbId,
      docRefs: payload.docRefs,
      abilities: payload.abilities?.length ? payload.abilities : DEFAULT_ABILITIES,
      expiresInDays: payload.expiresInDays,
      neverExpires: payload.neverExpires,
    } satisfies CreateKbSkillTokenApiBody;
    const response = await apiRequest<CreateKbSkillTokenApiEnvelope>('/skills/kb/token', {
      method: 'POST',
      body,
    });
    return normalizeTokenResult(unwrapResponse(response));
  },
};
