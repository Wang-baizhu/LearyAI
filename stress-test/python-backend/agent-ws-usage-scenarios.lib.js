// 当前文件职责：复用 agent 会话压测场景的 WebSocket 保活、HTTP query 提交与显式跳过逻辑。

import http from 'k6/http';
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const TEST_USER_ID_HEADER = 'x-test-user-id';

export function shouldSkipScenario(envPrefix) {
  return (__ENV[`${envPrefix}_RUN`] || '') !== '1';
}

export function buildScenarioOptions(vus, iterations, checksRateMetricName, scenarioAcceptanceMetricName) {
  return {
    vus,
    iterations,
    thresholds: {
      checks: ['rate>0.95'],
      [checksRateMetricName]: ['rate>0.99'],
      [scenarioAcceptanceMetricName]: ['rate>0.90'],
    },
  };
}

export function buildScenarioMetrics(prefix) {
  return {
    handshakeRate: new Rate(`${prefix}_handshake_rate`),
    scenarioAcceptanceRate: new Rate(`${prefix}_acceptance_rate`),
    sessionCreatedRate: new Rate(`${prefix}_session_created_rate`),
    sessionContextRate: new Rate(`${prefix}_session_context_rate`),
    queryAcceptedRate: new Rate(`${prefix}_query_accepted_rate`),
    queryHttpDuration: new Trend(`${prefix}_query_http_duration_ms`, true),
    queryRejectCount: new Counter(`${prefix}_query_reject_count`),
    protocolErrorCount: new Counter(`${prefix}_protocol_error_count`),
    timeoutCount: new Counter(`${prefix}_timeout_count`),
  };
}

export function buildHeaders(cookie) {
  const headers = {};
  if (cookie) {
    headers.Cookie = cookie;
  }
  const testUserId = resolveTestUserId();
  if (testUserId) {
    headers[TEST_USER_ID_HEADER] = testUserId;
  }
  return headers;
}

export function buildSessionCreatePayload(traceId, mode, projectId, kbId) {
  const payload = { cwd: './' };
  if (projectId) {
    payload.projectId = projectId;
  }
  if (kbId) {
    payload.kbId = kbId;
  }
  return { cmd: 'session.create', payload, meta: { traceId, mode } };
}

export function buildSessionContextPayload(agentSessionId, traceId, mode) {
  return {
    cmd: 'session.context',
    payload: {
      agentSessionId,
    },
    meta: {
      agentSessionId,
      traceId,
      mode,
    },
  };
}

export function buildAgentQueryRequest(agentSessionId, requestId, projectId, kbId, promptText, docRefs) {
  const payload = {
    agentSessionId,
    requestId,
    prompt: [{ type: 'text', text: promptText }],
  };
  if (projectId) {
    payload.projectId = projectId;
  }
  if (kbId) {
    payload.kbId = kbId;
  }
  if (docRefs?.length) {
    payload.docRefs = docRefs;
  }
  return payload;
}

export function deriveQueryUrl(wsUrl) {
  const match = String(wsUrl).match(/^(wss?):\/\/([^/]+)(?:\/.*)?$/i);
  if (!match) {
    throw new Error(`invalid AGENT_WS_URL: ${wsUrl}`);
  }
  const httpProtocol = match[1].toLowerCase() === 'wss' ? 'https' : 'http';
  return `${httpProtocol}://${match[2]}/agent/query`;
}

function buildHttpHeaders(cookie) {
  return {
    'Content-Type': 'application/json',
    ...buildHeaders(cookie),
  };
}

function parseJsonResponseBody(response) {
  try {
    return response.json();
  } catch (_error) {
    return null;
  }
}

export function submitAgentQuery(config) {
  const response = http.post(
    config.queryUrl,
    JSON.stringify(
      buildAgentQueryRequest(
        config.agentSessionId,
        config.requestId,
        config.projectId,
        config.kbId,
        config.promptText,
        config.docRefs
      )
    ),
    {
      headers: buildHttpHeaders(config.sessionCookie),
      tags: config.tags,
    }
  );
  const accepted = response.status === 202;
  config.metrics.queryAcceptedRate.add(accepted);
  config.metrics.queryHttpDuration.add(response.timings.duration);
  if (!accepted) {
    config.metrics.queryRejectCount.add(1);
  }
  return {
    accepted,
    response,
    body: parseJsonResponseBody(response),
  };
}

export function resolveTestUserId() {
  if ((__ENV.KIMI_AGENT_WS_TEST_MODE || '0') !== '1') {
    return '';
  }
  return String(__VU);
}

export function skippedScenarioChecks() {
  check(null, {
    'scenario skipped by env gate': () => true,
  });
}

export function runWsScenario(config) {
  const state = {
    sessionIds: [],
    agentResults: 0,
    createdSessions: 0,
    contextEvents: 0,
    httpAccepted: 0,
    hadError: false,
    timedOut: false,
    protocolErrors: [],
    businessErrors: [],
    httpRejects: [],
  };
  const queryUrl = config.queryUrl || deriveQueryUrl(config.url);

  const response = ws.connect(
    config.url,
    { headers: buildHeaders(config.sessionCookie), tags: config.tags },
    (socket) => {
      let activeSessionIndex = 0;
      let expectedSessionIndex = 0;

      function sendCreate(sessionIndex) {
        socket.send(
          JSON.stringify(
            buildSessionCreatePayload(
              `${config.traceId}-create-${sessionIndex + 1}`,
              config.mode,
              config.projectId,
              config.kbId
            )
          )
        );
      }

      function sendContext(sessionIndex) {
        const agentSessionId = state.sessionIds[sessionIndex] || '';
        socket.send(
          JSON.stringify(
            buildSessionContextPayload(agentSessionId, `${config.traceId}-context-${sessionIndex + 1}`, config.mode)
          )
        );
      }

      function sendQuery(sessionIndex, queryIndex) {
        const agentSessionId = state.sessionIds[sessionIndex] || '';
        const result = submitAgentQuery({
          queryUrl,
          sessionCookie: config.sessionCookie,
          agentSessionId,
          requestId: `${config.traceId}-query-${sessionIndex + 1}-${queryIndex + 1}`,
          projectId: config.projectId,
          kbId: config.kbId,
          promptText: config.prompts[queryIndex],
          docRefs: config.docRefs,
          tags: { ...config.tags, entry: 'agent_query_http' },
          metrics: config.metrics,
        });
        if (result.accepted) {
          state.httpAccepted += 1;
          return true;
        }
        state.hadError = true;
        state.httpRejects.push({
          status: result.response.status,
          body: result.body,
        });
        const plan = config.onQueryRejected?.({
          state,
          activeSessionIndex: sessionIndex,
          queryIndex,
          rejection: state.httpRejects[state.httpRejects.length - 1],
          close() {
            socket.close();
          },
        });
        if (plan?.acceptError) {
          config.metrics.scenarioAcceptanceRate.add(true);
        } else {
          config.metrics.scenarioAcceptanceRate.add(false);
        }
        socket.close();
        return false;
      }

      function handleSessionReady(sessionIndex) {
        const plan = config.onSessionReady({
          state,
          activeSessionIndex: sessionIndex,
        });
        if (plan?.nextAction === 'query') {
          sendQuery(sessionIndex, plan.queryIndex);
          return;
        }
        if (plan?.nextAction === 'close') {
          socket.close();
        }
      }

      socket.on('message', (raw) => {
        const message = JSON.parse(raw);

        if (message.event === 'session:created') {
          const agentSessionId = message.payload?.agentSessionId || message.meta?.agentSessionId || '';
          state.sessionIds[expectedSessionIndex] = agentSessionId;
          state.createdSessions += 1;
          config.metrics.sessionCreatedRate.add(true);
          activeSessionIndex = expectedSessionIndex;
          if (config.requestContextOnCreate) {
            sendContext(activeSessionIndex);
            return;
          }
          handleSessionReady(activeSessionIndex);
          return;
        }

        if (message.event === 'session:context') {
          state.contextEvents += 1;
          config.metrics.sessionContextRate.add(true);
          handleSessionReady(activeSessionIndex);
          return;
        }

        if (message.event === 'agent.result') {
          state.agentResults += 1;
          const plan = config.onAgentResult({
            state,
            activeSessionIndex,
            resultIndex: state.agentResults - 1,
            openNextSession() {
              expectedSessionIndex += 1;
              sendCreate(expectedSessionIndex);
            },
            sendNextQuery(queryIndex) {
              sendQuery(activeSessionIndex, queryIndex);
            },
            close() {
              socket.close();
            },
          });
          if (plan?.nextAction === 'query') {
            sendQuery(activeSessionIndex, plan.queryIndex);
            return;
          }
          if (plan?.nextAction === 'create') {
            expectedSessionIndex += 1;
            sendCreate(expectedSessionIndex);
            return;
          }
          if (plan?.nextAction === 'close') {
            socket.close();
          }
          return;
        }

        if (message.event === 'error') {
          state.hadError = true;
          state.businessErrors.push(message);
          const plan = config.onError({
            state,
            activeSessionIndex,
            errorMessage: message,
            close() {
              socket.close();
            },
          });
          if (plan?.acceptError) {
            config.metrics.scenarioAcceptanceRate.add(true);
          } else {
            config.metrics.scenarioAcceptanceRate.add(false);
          }
          socket.close();
          return;
        }
      });

      socket.on('error', (error) => {
        state.hadError = true;
        state.protocolErrors.push(String(error));
        config.metrics.protocolErrorCount.add(1);
      });

      socket.setTimeout(() => {
        state.timedOut = true;
        config.metrics.timeoutCount.add(1);
        const plan = config.onTimeout?.({
          state,
          activeSessionIndex,
          close() {
            socket.close();
          },
        });
        if (plan?.acceptTimeout) {
          config.metrics.scenarioAcceptanceRate.add(true);
        } else {
          config.metrics.scenarioAcceptanceRate.add(false);
        }
        socket.close();
      }, config.timeoutMs);

      sendCreate(0);
    }
  );

  config.metrics.handshakeRate.add(response && response.status === 101);
  return { response, state };
}
