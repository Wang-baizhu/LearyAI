// modules/ai-chat/shared/api/agentWs 负责定义 AI Chat WebSocket 协议类型与连接地址构造。
import { getRuntimeEndpoints } from '@/shared/config/endpoints';

export const buildAgentWsUrl = () => {
  try {
    const { agentWsUrl } = getRuntimeEndpoints();
    if (/^wss?:\/\//.test(agentWsUrl)) {
      return new URL(agentWsUrl).toString();
    }
    if (typeof window !== 'undefined' && window.location) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return new URL(agentWsUrl, `${protocol}//${window.location.host}`).toString();
    }
    return new URL(`ws://localhost:8081${agentWsUrl}`).toString();
  } catch {
    return 'ws://localhost:8081/agent/ws';
  }
};

export const buildAgentQueryUrl = () => {
  try {
    const { agentWsUrl } = getRuntimeEndpoints();
    if (/^wss?:\/\//.test(agentWsUrl)) {
      const wsUrl = new URL(agentWsUrl);
      wsUrl.protocol = wsUrl.protocol === 'wss:' ? 'https:' : 'http:';
      wsUrl.pathname = wsUrl.pathname.replace(/\/ws$/, '/query');
      wsUrl.search = '';
      wsUrl.hash = '';
      return wsUrl.toString();
    }
    if (typeof window !== 'undefined' && window.location) {
      const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
      return new URL(agentWsUrl.replace(/\/ws$/, '/query'), `${protocol}//${window.location.host}`).toString();
    }
    return 'http://localhost:8081/agent/query';
  } catch {
    return 'http://localhost:8081/agent/query';
  }
};

export interface AgentWsMeta {
  agentSessionId?: string;
  subagentId?: string;
  traceId?: string;
  userId?: number;
  projectId?: string;
  kbId?: string;
}

export interface AgentWsCommand<TPayload = unknown> {
  cmd: string;
  payload: TPayload;
  meta?: AgentWsMeta;
}

export interface AgentWsEvent<TPayload = unknown> {
  cmd: string;
  payload: TPayload;
  meta?: AgentWsMeta;
}

export interface AgentWsRuntimeEnvelope<TPayload = unknown> {
  cmd?: string;
  event?: string;
  payload: TPayload;
  meta?: AgentWsMeta;
}

export type AgentWsEnvelope<TPayload = unknown> = AgentWsCommand<TPayload> | AgentWsEvent<TPayload>;
