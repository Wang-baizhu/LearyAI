// 当前文件职责：使用 k6 对 ai_chat_tokens 非会员 single-call 校验与结算链路进行压测。

import { check } from 'k6';
import grpc from 'k6/net/grpc';
import { Counter, Rate, Trend } from 'k6/metrics';

const client = new grpc.Client();
client.load(['../..'], 'backend/learyAI/src/main/proto/usage/v1/usage_service.proto');

const vus = Number(__ENV.USAGE_SINGLE_CALL_VUS || 10);
const duration = __ENV.USAGE_SINGLE_CALL_DURATION || '30s';
const target = (__ENV.USAGE_GRPC_TARGET || `${__ENV.USAGE_GRPC_HOST || '127.0.0.1'}:${__ENV.USAGE_GRPC_PORT || '9091'}`).trim();
const userId = Number(__ENV.USAGE_USER_ID || 10001);
const projectId = (__ENV.USAGE_PROJECT_ID || 'project-usage-single-call').trim();
const metric = (__ENV.USAGE_METRIC || 'ai_chat_tokens').trim();
const requestedAmount = Number(__ENV.USAGE_REQUESTED_AMOUNT || 32);
const actualAmount = Number(__ENV.USAGE_ACTUAL_AMOUNT || 24);
const reservationTtlSeconds = Number(__ENV.USAGE_RESERVATION_TTL_SECONDS || 1800);
const ak = (__ENV.USAGE_GRPC_AK || '').trim();

const reserveSuccessRate = new Rate('usage_single_call_reserve_success_rate');
const commitSuccessRate = new Rate('usage_single_call_commit_success_rate');
const grpcFailureCount = new Counter('usage_single_call_grpc_failure_count');
const reserveDuration = new Trend('usage_single_call_reserve_duration', true);
const commitDuration = new Trend('usage_single_call_commit_duration', true);

export const options = {
  vus,
  duration,
  thresholds: {
    checks: ['rate>0.95'],
    usage_single_call_reserve_success_rate: ['rate>0.95'],
    usage_single_call_commit_success_rate: ['rate>0.95'],
    usage_single_call_reserve_duration: ['p(95)<300', 'p(99)<800'],
    usage_single_call_commit_duration: ['p(95)<300', 'p(99)<800'],
  },
};

function metadata() {
  return ak ? { 'x-usage-ak': ak } : {};
}

function nowIso() {
  return new Date().toISOString();
}

function prefix() {
  return `sc-${__VU}-${__ITER}-${Date.now()}`;
}

function invokeWithDuration(method, payload, params, trend) {
  const startedAt = Date.now();
  const response = client.invoke(method, payload, params);
  trend.add(Date.now() - startedAt);
  return response;
}

export default function () {
  client.connect(target, { plaintext: true });
  const callPrefix = prefix();
  const reservationId = `reservation-${callPrefix}`;
  const requestId = `request-${callPrefix}`;

  const reserveResponse = invokeWithDuration('usage.v1.UsageControlService/ReserveSingleCall', {
    user_id: userId,
    project_id: projectId,
    metric,
    reservation_id: reservationId,
    request_id: requestId,
    requested_amount: requestedAmount,
    reservation_ttl_seconds: reservationTtlSeconds,
    metadata: {
      service: 'stress-test',
      mode: 'single-call',
      traceId: callPrefix,
    },
  }, { metadata: metadata(), tags: { rpc: 'ReserveSingleCall', chain: 'single_call' } }, reserveDuration);
  const reserveOk = reserveResponse && reserveResponse.status === grpc.StatusOK
    && reserveResponse.message && reserveResponse.message.reserved === true;
  reserveSuccessRate.add(reserveOk);
  if (!reserveOk) {
    grpcFailureCount.add(1);
    client.close();
    check(reserveResponse, {
      'single-call reserve status is OK': (res) => res && res.status === grpc.StatusOK,
      'single-call reserve accepted': (res) => res && res.message && res.message.reserved === true,
    });
    return;
  }

  const commitResponse = invokeWithDuration('usage.v1.UsageControlService/CommitSingleCall', {
    user_id: userId,
    project_id: projectId,
    metric,
    reservation_id: reservationId,
    request_id: requestId,
    requested_amount: requestedAmount,
    actual_amount: actualAmount,
    idempotency_key: `commit-${callPrefix}`,
    source_type: 'stress_test_single_call',
    source_id: callPrefix,
    metadata: {
      service: 'stress-test',
      mode: 'single-call',
      traceId: callPrefix,
    },
    occurred_at: nowIso(),
  }, { metadata: metadata(), tags: { rpc: 'CommitSingleCall', chain: 'single_call' } }, commitDuration);
  const commitOk = commitResponse && commitResponse.status === grpc.StatusOK
    && commitResponse.message && commitResponse.message.applied === true;
  commitSuccessRate.add(commitOk);
  if (!commitOk) {
    grpcFailureCount.add(1);
  }

  check(commitResponse, {
    'single-call commit status is OK': (res) => res && res.status === grpc.StatusOK,
    'single-call commit applied': (res) => res && res.message && res.message.applied === true,
  });
  client.close();
}
