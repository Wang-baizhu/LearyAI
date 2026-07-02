// 当前文件职责：验证固定 usage 下同一 session 通过 HTTP 提交连续两次 query 都成功完成，覆盖 1+2 次 llm_call 的整轮回放。

import { check } from 'k6';
import {
  buildScenarioMetrics,
  buildScenarioOptions,
  deriveQueryUrl,
  runWsScenario,
  shouldSkipScenario,
  skippedScenarioChecks,
} from './agent-ws-usage-scenarios.lib.js';

const scenarioPrefix = 'agent_ws_usage_scenario_full_success';
const enabled = !shouldSkipScenario('AGENT_WS_USAGE_SCENARIO_FULL_SUCCESS');
const vus = Number(__ENV.AGENT_WS_USAGE_SCENARIO_FULL_SUCCESS_VUS || 1);
const iterations = Number(__ENV.AGENT_WS_USAGE_SCENARIO_FULL_SUCCESS_ITERATIONS || 1);
const url = __ENV.AGENT_WS_URL || 'ws://127.0.0.1:8081/agent/ws';
const queryUrl = __ENV.AGENT_QUERY_URL || deriveQueryUrl(url);
const sessionCookie = __ENV.AGENT_WS_USAGE_SCENARIO_FULL_SUCCESS_SESSION_COOKIE || __ENV.AGENT_WS_SESSION_COOKIE || '';
const projectId = (__ENV.AGENT_WS_USAGE_SCENARIO_FULL_SUCCESS_PROJECT_ID || __ENV.AGENT_WS_PROJECT_ID || '').trim();
const kbId = (__ENV.AGENT_WS_USAGE_SCENARIO_FULL_SUCCESS_KB_ID || __ENV.AGENT_WS_KB_ID || '').trim();
const timeoutMs = Number(__ENV.AGENT_WS_USAGE_SCENARIO_FULL_SUCCESS_TIMEOUT_MS || __ENV.AGENT_WS_TIMEOUT_MS || 15000);
const firstPromptText = __ENV.AGENT_WS_USAGE_SCENARIO_FULL_SUCCESS_FIRST_PROMPT || '介绍一下你能做什么';
const secondPromptText = __ENV.AGENT_WS_USAGE_SCENARIO_FULL_SUCCESS_SECOND_PROMPT || '好的';
const requestContextOnCreate = (__ENV.AGENT_WS_REQUEST_CONTEXT_ON_CREATE || '1') !== '0';
const metrics = buildScenarioMetrics(scenarioPrefix);

export const options = enabled
  ? buildScenarioOptions(vus, iterations, `${scenarioPrefix}_handshake_rate`, `${scenarioPrefix}_acceptance_rate`)
  : { vus: 1, iterations: 1 };

export default function () {
  if (!enabled) {
    skippedScenarioChecks();
    return;
  }

  const traceId = `full-success-${__VU}-${__ITER}`;
  const { response, state } = runWsScenario({
    url,
    sessionCookie,
    queryUrl,
    mode: 'non_member',
    projectId,
    kbId,
    timeoutMs,
    traceId,
    prompts: [firstPromptText, secondPromptText],
    requestContextOnCreate,
    tags: { service: 'python-backend', endpoint: 'agent_http_usage_scenario_full_success' },
    metrics,
    onSessionReady() {
      return { nextAction: 'query', queryIndex: 0 };
    },
    onAgentResult({ resultIndex }) {
      if (resultIndex === 0) {
        return { nextAction: 'query', queryIndex: 1 };
      }
      metrics.scenarioAcceptanceRate.add(true);
      return { nextAction: 'close' };
    },
    onError() {
      return { acceptError: false };
    },
    onQueryRejected() {
      return { acceptError: false };
    },
  });

  check(response, {
    'full success handshake status is 101': (res) => res && res.status === 101,
    'full success created one session': () => state.createdSessions === 1,
    'full success accepted two HTTP queries': () => state.httpAccepted === 2,
    'full success completed two query results': () => state.agentResults === 2,
    'full success has no business error': () => state.businessErrors.length === 0,
    'full success has no http reject': () => state.httpRejects.length === 0,
    'full success has no protocol error': () => !state.hadError || state.businessErrors.length === 0,
    'full success has no timeout': () => !state.timedOut,
  });
}
