// 当前文件职责：验证固定 usage 下首个 session 完成两次 HTTP query 后，新开 session 的下一次 query 会被接受进入执行，并最终通过 WS error 返回剩余额度拒绝。

import { check } from 'k6';
import {
  buildScenarioMetrics,
  buildScenarioOptions,
  deriveQueryUrl,
  runWsScenario,
  shouldSkipScenario,
  skippedScenarioChecks,
} from './agent-ws-usage-scenarios.lib.js';

const scenarioPrefix = 'agent_ws_usage_scenario_cross_session_reject';
const enabled = !shouldSkipScenario('AGENT_WS_USAGE_SCENARIO_CROSS_SESSION_REJECT');
const vus = Number(__ENV.AGENT_WS_USAGE_SCENARIO_CROSS_SESSION_REJECT_VUS || 1);
const iterations = Number(__ENV.AGENT_WS_USAGE_SCENARIO_CROSS_SESSION_REJECT_ITERATIONS || 1);
const url = __ENV.AGENT_WS_URL || 'ws://127.0.0.1:8081/agent/ws';
const queryUrl = __ENV.AGENT_QUERY_URL || deriveQueryUrl(url);
const sessionCookie = __ENV.AGENT_WS_USAGE_SCENARIO_CROSS_SESSION_REJECT_SESSION_COOKIE || __ENV.AGENT_WS_SESSION_COOKIE || '';
const projectId = (__ENV.AGENT_WS_USAGE_SCENARIO_CROSS_SESSION_REJECT_PROJECT_ID || __ENV.AGENT_WS_PROJECT_ID || '').trim();
const kbId = (__ENV.AGENT_WS_USAGE_SCENARIO_CROSS_SESSION_REJECT_KB_ID || __ENV.AGENT_WS_KB_ID || '').trim();
const timeoutMs = Number(__ENV.AGENT_WS_USAGE_SCENARIO_CROSS_SESSION_REJECT_TIMEOUT_MS || __ENV.AGENT_WS_TIMEOUT_MS || 15000);
const firstPromptText = __ENV.AGENT_WS_USAGE_SCENARIO_CROSS_SESSION_REJECT_FIRST_PROMPT || '介绍一下你能做什么';
const secondPromptText = __ENV.AGENT_WS_USAGE_SCENARIO_CROSS_SESSION_REJECT_SECOND_PROMPT || '好的';
const thirdPromptText = __ENV.AGENT_WS_USAGE_SCENARIO_CROSS_SESSION_REJECT_THIRD_PROMPT || '再介绍一次你能做什么';
const expectedErrorCode = (__ENV.AGENT_WS_USAGE_SCENARIO_CROSS_SESSION_REJECT_ERROR_CODE || '').trim();
const expectedErrorText = (__ENV.AGENT_WS_USAGE_SCENARIO_CROSS_SESSION_REJECT_ERROR_TEXT || '').trim();
const requestContextOnCreate = (__ENV.AGENT_WS_REQUEST_CONTEXT_ON_CREATE || '1') !== '0';
const metrics = buildScenarioMetrics(scenarioPrefix);

export const options = enabled
  ? buildScenarioOptions(vus, iterations, `${scenarioPrefix}_handshake_rate`, `${scenarioPrefix}_acceptance_rate`)
  : { vus: 1, iterations: 1 };

function extractErrorCode(errorMessage) {
  if (!errorMessage) {
    return '';
  }
  if (errorMessage.status) {
    return String(errorMessage.body?.error?.code || errorMessage.body?.code || errorMessage.status);
  }
  return errorMessage?.payload?.code || errorMessage?.meta?.code || '';
}

function extractErrorText(errorMessage) {
  if (!errorMessage) {
    return '';
  }
  if (errorMessage.status) {
    return String(errorMessage.body?.error?.message || errorMessage.body?.message || '');
  }
  return String(errorMessage?.payload?.message || errorMessage?.payload?.detail || errorMessage?.meta?.message || '');
}

function matchesExpectedError(errorMessage) {
  if (expectedErrorCode) {
    const code = extractErrorCode(errorMessage);
    if (code !== expectedErrorCode) {
      return false;
    }
  }
  if (expectedErrorText) {
    const text = extractErrorText(errorMessage);
    if (!text.includes(expectedErrorText)) {
      return false;
    }
  }
  return true;
}

export default function () {
  if (!enabled) {
    skippedScenarioChecks();
    return;
  }

  const traceId = `cross-session-reject-${__VU}-${__ITER}`;
  const { response, state } = runWsScenario({
    url,
    sessionCookie,
    queryUrl,
    mode: 'non_member',
    projectId,
    kbId,
    timeoutMs,
    traceId,
    prompts: [firstPromptText, secondPromptText, thirdPromptText],
    requestContextOnCreate,
    tags: { service: 'python-backend', endpoint: 'agent_http_usage_scenario_cross_session_reject' },
    metrics,
    onSessionReady({ activeSessionIndex }) {
      return { nextAction: 'query', queryIndex: activeSessionIndex === 0 ? 0 : 2 };
    },
    onAgentResult({ activeSessionIndex, resultIndex }) {
      if (activeSessionIndex === 0 && resultIndex === 0) {
        return { nextAction: 'query', queryIndex: 1 };
      }
      if (activeSessionIndex === 0 && resultIndex === 1) {
        return { nextAction: 'create' };
      }
      metrics.scenarioAcceptanceRate.add(false);
      return { nextAction: 'close' };
    },
    onError({ errorMessage }) {
      return { acceptError: matchesExpectedError(errorMessage) };
    },
    onQueryRejected({ rejection }) {
      return { acceptError: matchesExpectedError(rejection) };
    },
    onTimeout({ state }) {
      return { acceptTimeout: state.agentResults === 2 };
    },
  });

  const firstError = state.httpRejects[0] || state.businessErrors[0];
  check(response, {
    'cross-session reject handshake status is 101': (res) => res && res.status === 101,
    'cross-session reject created two sessions': () => state.createdSessions === 2,
    'cross-session reject accepted all three HTTP queries before ws reject': () => state.httpAccepted === 3,
    'cross-session reject completed two query results before reject': () => state.agentResults === 2,
    'cross-session reject returned reject signal': () => state.httpRejects.length + state.businessErrors.length >= 1,
    'cross-session reject matched expected error': () => matchesExpectedError(firstError),
    'cross-session reject did not unexpectedly succeed third query': () => state.agentResults === 2,
  });
}
