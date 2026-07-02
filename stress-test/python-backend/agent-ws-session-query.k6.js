// 当前文件职责：使用 k6 对 agent 的 ws 建连 -> session.create -> session.context -> 两次 HTTP query 提交链路进行压测。

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

const vus = Number(__ENV.AGENT_WS_VUS || 5);
const iterations = Number(__ENV.AGENT_WS_ITERATIONS || 5);
const url = __ENV.AGENT_WS_URL || 'ws://127.0.0.1:8081/agent/ws';
const queryUrl = __ENV.AGENT_QUERY_URL || deriveQueryUrl(url);
const sessionCookie = __ENV.AGENT_WS_SESSION_COOKIE || '';
const projectId = (__ENV.AGENT_WS_PROJECT_ID || '11111111-1111-1111-1111-111111111111').trim();
const kbId = (__ENV.AGENT_WS_KB_ID || '').trim();
const docId = (__ENV.AGENT_WS_DOC_ID || '').trim();
const docRefsJson = (__ENV.AGENT_WS_DOC_REFS_JSON || '').trim();
const firstPromptText = '介绍一下你能做什么';
const secondPromptText = '好的';
const timeoutMs = Number(__ENV.AGENT_WS_TIMEOUT_MS || 15000);
const requestContextOnCreate = (__ENV.AGENT_WS_REQUEST_CONTEXT_ON_CREATE || '1') !== '0';

const sessionCreatedRate = new Rate('agent_ws_session_created_rate');
const sessionContextRate = new Rate('agent_ws_session_context_rate');
const agentQueryAcceptedRate = new Rate('agent_ws_query_accepted_rate');
const agentResultRate = new Rate('agent_ws_agent_result_rate');
const agentErrorCount = new Counter('agent_ws_error_count');
const agentQueryRejectCount = new Counter('agent_ws_query_reject_count');
const agentTimeoutCount = new Counter('agent_ws_timeout_count');

function parseDocRefs() {
  if (docRefsJson) {
    return JSON.parse(docRefsJson);
  }
  if (docId) {
    return [{ id: docId }];
  }
  return [];
}

const docRefs = parseDocRefs();

export const options = {
  vus,
  iterations,
  thresholds: {
    checks: ['rate>0.95'],
    agent_ws_session_created_rate: ['rate>0.95'],
    agent_ws_query_accepted_rate: ['rate>0.90'],
    agent_ws_agent_result_rate: ['rate>0.90'],
  },
};

function resolveSessionCookie() {
  if (!sessionCookie) {
    return '';
  }
  if (sessionCookie !== 'sessionId=test') {
    return sessionCookie;
  }
  return `sessionId=test-${__VU}-${__ITER}`;
}

function buildSessionCreatePayload(traceId) {
  const payload = { cwd: './' };
  if (projectId) {
    payload.projectId = projectId;
  }
  if (docId) {
    payload.docId = docId;
  }
  if (kbId) {
    payload.kbId = kbId;
  }
  return {
    cmd: 'session.create',
    payload,
    meta: {
      projectId: projectId || undefined,
      traceId,
    },
  };
}

function submitQuery(agentSessionId, traceId, promptText) {
  return submitAgentQuery({
    queryUrl,
    sessionCookie: resolveSessionCookie(),
    agentSessionId,
    requestId: traceId,
    projectId,
    kbId,
    promptText,
    docRefs,
    testUserId: resolveTestUserId(),
    tags: { service: 'python-backend', endpoint: 'agent_query_http' },
    metrics: {
      queryAcceptedRate: agentQueryAcceptedRate,
      queryHttpDuration: { add() {} },
      queryRejectCount: agentQueryRejectCount,
    },
  });
}

export default function () {
  const traceId = `k6-${__VU}-${__ITER}`;
  let created = false;
  let contextLoaded = !requestContextOnCreate;
  let completed = false;
  let timedOut = false;
  let agentSessionId = '';
  let hadError = false;
  let queryStage = 'pending';

  const response = ws.connect(
    url,
    { headers: buildHeaders(resolveSessionCookie()), tags: { service: 'python-backend', endpoint: 'agent_ws' } },
    (socket) => {
    socket.on('message', (raw) => {
      let message;
      try {
        message = JSON.parse(raw);
      } catch (error) {
        hadError = true;
        agentErrorCount.add(1);
        socket.close();
        throw error;
      }

      if (message.event === 'session:created') {
        created = true;
        agentSessionId = message.payload?.agentSessionId || message.meta?.agentSessionId || '';
        sessionCreatedRate.add(true);
        if (requestContextOnCreate) {
          socket.send(JSON.stringify(buildSessionContextPayload(agentSessionId, `${traceId}-context`, 'default')));
          return;
        }
        contextLoaded = true;
        queryStage = 'first_running';
        if (!submitQuery(agentSessionId, `${traceId}-query-1`, firstPromptText).accepted) {
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
        queryStage = 'first_running';
        if (!submitQuery(agentSessionId, `${traceId}-query-1`, firstPromptText).accepted) {
          hadError = true;
          agentErrorCount.add(1);
          agentResultRate.add(false);
          socket.close();
        }
        return;
      }

      if (message.event === 'agent.result') {
        if (queryStage === 'first_running') {
          queryStage = 'second_running';
          if (!submitQuery(agentSessionId, `${traceId}-query-2`, secondPromptText).accepted) {
            hadError = true;
            agentErrorCount.add(1);
            agentResultRate.add(false);
            socket.close();
          }
          return;
        }
        if (queryStage === 'second_running') {
          completed = true;
          queryStage = 'done';
          agentResultRate.add(true);
          socket.close();
          return;
        }
        hadError = true;
        agentErrorCount.add(1);
        agentResultRate.add(false);
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

  check(response, {
    'agent ws handshake status is 101': (res) => res && res.status === 101,
    'agent ws session created': () => created,
    'agent ws session context loaded when enabled': () => contextLoaded,
    'agent ws agent result completed': () => completed,
    'agent ws has no protocol error': () => !hadError,
    'agent ws has no timeout': () => !timedOut,
  });
}
