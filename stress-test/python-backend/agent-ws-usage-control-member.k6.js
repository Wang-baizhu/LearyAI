// 当前文件职责：使用 k6 对会员模式下自动触发 usage-control 的 ws 建连 -> session.create -> session.context -> HTTP query 链路进行压测。

import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Rate } from 'k6/metrics';
import {
  buildHeaders,
  buildSessionContextPayload,
  deriveQueryUrl,
  resolveTestUserId,
  submitAgentQuery,
} from './agent-ws-usage-scenarios.lib.js';

const vus = Number(__ENV.AGENT_WS_MEMBER_VUS || 5);
const iterations = Number(__ENV.AGENT_WS_MEMBER_ITERATIONS || 5);
const url = __ENV.AGENT_WS_URL || 'ws://127.0.0.1:8081/agent/ws';
const queryUrl = __ENV.AGENT_QUERY_URL || deriveQueryUrl(url);
const sessionCookie = __ENV.AGENT_WS_MEMBER_SESSION_COOKIE || __ENV.AGENT_WS_SESSION_COOKIE || '';
const promptText = __ENV.AGENT_WS_MEMBER_PROMPT_TEXT || __ENV.AGENT_WS_PROMPT_TEXT || '你好';
const projectId = (__ENV.AGENT_WS_MEMBER_PROJECT_ID || __ENV.AGENT_WS_PROJECT_ID || '').trim();
const kbId = (__ENV.AGENT_WS_MEMBER_KB_ID || __ENV.AGENT_WS_KB_ID || '').trim();
const timeoutMs = Number(__ENV.AGENT_WS_MEMBER_TIMEOUT_MS || __ENV.AGENT_WS_TIMEOUT_MS || 15000);
const requestContextOnCreate = (__ENV.AGENT_WS_REQUEST_CONTEXT_ON_CREATE || '1') !== '0';

const handshakeRate = new Rate('agent_ws_member_handshake_rate');
const sessionCreatedRate = new Rate('agent_ws_member_session_created_rate');
const sessionContextRate = new Rate('agent_ws_member_session_context_rate');
const queryAcceptedRate = new Rate('agent_ws_member_query_accepted_rate');
const agentResultRate = new Rate('agent_ws_member_agent_result_rate');
const agentErrorCount = new Counter('agent_ws_member_error_count');
const queryRejectCount = new Counter('agent_ws_member_query_reject_count');
const agentTimeoutCount = new Counter('agent_ws_member_timeout_count');

export const options = {
  vus,
  iterations,
  thresholds: {
    checks: ['rate>0.95'],
    agent_ws_member_handshake_rate: ['rate>0.99'],
    agent_ws_member_session_created_rate: ['rate>0.95'],
    agent_ws_member_query_accepted_rate: ['rate>0.90'],
    agent_ws_member_agent_result_rate: ['rate>0.90'],
  },
};

function buildSessionCreatePayload(traceId) {
  const payload = { cwd: './' };
  if (projectId) {
    payload.projectId = projectId;
  }
  if (kbId) {
    payload.kbId = kbId;
  }
  return { cmd: 'session.create', payload, meta: { traceId, mode: 'member' } };
}

function submitQuery(agentSessionId, traceId) {
  return submitAgentQuery({
    queryUrl,
    sessionCookie,
    agentSessionId,
    requestId: traceId,
    projectId,
    kbId,
    promptText,
    testUserId: resolveTestUserId(),
    tags: { service: 'python-backend', endpoint: 'agent_query_http_member' },
    metrics: {
      queryAcceptedRate,
      queryHttpDuration: { add() {} },
      queryRejectCount,
    },
  });
}

export default function () {
  const traceId = `member-${__VU}-${__ITER}`;
  let created = false;
  let contextLoaded = !requestContextOnCreate;
  let completed = false;
  let timedOut = false;
  let hadError = false;
  let agentSessionId = '';

  const response = ws.connect(
    url,
    { headers: buildHeaders(sessionCookie), tags: { service: 'python-backend', endpoint: 'agent_ws_member' } },
    (socket) => {
    socket.on('message', (raw) => {
      const message = JSON.parse(raw);
      if (message.event === 'session:created') {
        created = true;
        agentSessionId = message.payload?.agentSessionId || message.meta?.agentSessionId || '';
        sessionCreatedRate.add(true);
        if (requestContextOnCreate) {
          socket.send(JSON.stringify(buildSessionContextPayload(agentSessionId, `${traceId}-context`, 'member')));
          return;
        }
        contextLoaded = true;
        if (!submitQuery(agentSessionId, `${traceId}-query`).accepted) {
          hadError = true;
          agentErrorCount.add(1);
          agentResultRate.add(false);
          socket.close();
        }
        return;
      }
      if (message.event === 'session:context') {
        contextLoaded = true;
        sessionContextRate.add(true);
        if (!submitQuery(agentSessionId, `${traceId}-query`).accepted) {
          hadError = true;
          agentErrorCount.add(1);
          agentResultRate.add(false);
          socket.close();
        }
        return;
      }
      if (message.event === 'agent.result') {
        completed = true;
        agentResultRate.add(true);
        socket.close();
        return;
      }
      if (message.event === 'error') {
        hadError = true;
        agentErrorCount.add(1);
        if (!created) {
          sessionCreatedRate.add(false);
        }
        agentResultRate.add(false);
        socket.close();
      }
    });

    socket.setTimeout(() => {
      if (!completed) {
        timedOut = true;
        agentTimeoutCount.add(1);
        if (!created) {
          sessionCreatedRate.add(false);
        }
        agentResultRate.add(false);
        socket.close();
      }
    }, timeoutMs);

    socket.send(JSON.stringify(buildSessionCreatePayload(`${traceId}-create`)));
    }
  );

  handshakeRate.add(response && response.status === 101);
  check(response, {
    'member ws handshake status is 101': (res) => res && res.status === 101,
    'member ws session created': () => created,
    'member ws session context loaded when enabled': () => contextLoaded,
    'member ws agent result completed': () => completed,
    'member ws has no protocol error': () => !hadError,
    'member ws has no timeout': () => !timedOut,
  });
}
