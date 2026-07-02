// 当前文件职责：使用 k6 对 ai_chat_tokens 非会员 single-call 预占后释放链路进行压测。

import { check } from 'k6';
import grpc from 'k6/net/grpc';
import { Counter, Rate, Trend } from 'k6/metrics';

const client = new grpc.Client();
client.load(['../..'], 'backend/learyAI/src/main/proto/usage/v1/usage_service.proto');

const vus = Number(__ENV.USAGE_SINGLE_CALL_RELEASE_VUS || 10);
const duration = __ENV.USAGE_SINGLE_CALL_RELEASE_DURATION || '30s';
const target = (__ENV.USAGE_GRPC_TARGET || `${__ENV.USAGE_GRPC_HOST || '127.0.0.1'}:${__ENV.USAGE_GRPC_PORT || '9091'}`).trim();
const userId = Number(__ENV.USAGE_USER_ID || 10001);
const projectId = (__ENV.USAGE_PROJECT_ID || 'project-usage-single-call').trim();
const metric = (__ENV.USAGE_METRIC || 'ai_chat_tokens').trim();
const requestedAmount = Number(__ENV.USAGE_REQUESTED_AMOUNT || 32);
const reservationTtlSeconds = Number(__ENV.USAGE_RESERVATION_TTL_SECONDS || 1800);
const ak = (__ENV.USAGE_GRPC_AK || '').trim();

const reserveSuccessRate = new Rate('usage_single_call_release_reserve_success_rate');
const releaseSuccessRate = new Rate('usage_single_call_release_success_rate');
const grpcFailureCount = new Counter('usage_single_call_release_grpc_failure_count');
const reserveDuration = new Trend('usage_single_call_release_reserve_duration', true);
const releaseDuration = new Trend('usage_single_call_release_duration', true);

export const options = {
  vus,
  duration,
  thresholds: {
    checks: ['rate>0.95'],
    usage_single_call_release_reserve_success_rate: ['rate>0.95'],
    usage_single_call_release_success_rate: ['rate>0.95'],
    usage_single_call_release_reserve_duration: ['p(95)<300', 'p(99)<800'],
    usage_single_call_release_duration: ['p(95)<300', 'p(99)<800'],
  },
};

function metadata() {
  return ak ? { 'x-usage-ak': ak } : {};
}

function prefix() {
  return `scr-${__VU}-${__ITER}-${Date.now()}`;
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
      mode: 'single-call-release',
      traceId: callPrefix,
    },
  }, { metadata: metadata(), tags: { rpc: 'ReserveSingleCall', chain: 'single_call_release' } }, reserveDuration);
  const reserveOk = reserveResponse && reserveResponse.status === grpc.StatusOK
    && reserveResponse.message && reserveResponse.message.reserved === true;
  reserveSuccessRate.add(reserveOk);
  if (!reserveOk) {
    grpcFailureCount.add(1);
    client.close();
    check(reserveResponse, {
      'single-call release reserve status is OK': (res) => res && res.status === grpc.StatusOK,
      'single-call release reserve accepted': (res) => res && res.message && res.message.reserved === true,
    });
    return;
  }

  const releaseResponse = invokeWithDuration('usage.v1.UsageControlService/ReleaseSingleCall', {
    user_id: userId,
    project_id: projectId,
    metric,
    reservation_id: reservationId,
    request_id: requestId,
  }, { metadata: metadata(), tags: { rpc: 'ReleaseSingleCall', chain: 'single_call_release' } }, releaseDuration);
  const releaseOk = releaseResponse && releaseResponse.status === grpc.StatusOK
    && releaseResponse.message && releaseResponse.message.released === true;
  releaseSuccessRate.add(releaseOk);
  if (!releaseOk) {
    grpcFailureCount.add(1);
  }

  check(releaseResponse, {
    'single-call release status is OK': (res) => res && res.status === grpc.StatusOK,
    'single-call release applied': (res) => res && res.message && res.message.released === true,
  });
  client.close();
}
