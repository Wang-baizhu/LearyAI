// 当前文件职责：使用 k6 对 ai_chat_tokens 会员 turn lease 校验与结算链路进行压测。

import { check } from 'k6';
import grpc from 'k6/net/grpc';
import { Counter, Rate, Trend } from 'k6/metrics';

const client = new grpc.Client();
client.load(['../..'], 'backend/learyAI/src/main/proto/usage/v1/usage_service.proto');

const vus = Number(__ENV.USAGE_TURN_LEASE_VUS || 10);
const duration = __ENV.USAGE_TURN_LEASE_DURATION || '30s';
const target = (__ENV.USAGE_GRPC_TARGET || `${__ENV.USAGE_GRPC_HOST || '127.0.0.1'}:${__ENV.USAGE_GRPC_PORT || '9091'}`).trim();
const userId = Number(__ENV.USAGE_USER_ID || 10001);
const projectId = (__ENV.USAGE_PROJECT_ID || 'project-usage-turn-lease').trim();
const metric = (__ENV.USAGE_METRIC || 'ai_chat_tokens').trim();
const actualAmount = Number(__ENV.USAGE_ACTUAL_AMOUNT || 24);
const leaseTtlSeconds = Number(__ENV.USAGE_LEASE_TTL_SECONDS || 1800);
const ak = (__ENV.USAGE_GRPC_AK || '').trim();

const policySuccessRate = new Rate('usage_turn_lease_policy_success_rate');
const openSuccessRate = new Rate('usage_turn_lease_open_success_rate');
const commitSuccessRate = new Rate('usage_turn_lease_commit_success_rate');
const closeSuccessRate = new Rate('usage_turn_lease_close_success_rate');
const grpcFailureCount = new Counter('usage_turn_lease_grpc_failure_count');
const policyDuration = new Trend('usage_turn_lease_policy_duration', true);
const openDuration = new Trend('usage_turn_lease_open_duration', true);
const commitDuration = new Trend('usage_turn_lease_commit_duration', true);
const closeDuration = new Trend('usage_turn_lease_close_duration', true);

export const options = {
  vus,
  duration,
  thresholds: {
    checks: ['rate>0.95'],
    usage_turn_lease_policy_success_rate: ['rate>0.95'],
    usage_turn_lease_open_success_rate: ['rate>0.95'],
    usage_turn_lease_commit_success_rate: ['rate>0.95'],
    usage_turn_lease_close_success_rate: ['rate>0.95'],
    usage_turn_lease_open_duration: ['p(95)<300', 'p(99)<800'],
    usage_turn_lease_commit_duration: ['p(95)<300', 'p(99)<800'],
    usage_turn_lease_close_duration: ['p(95)<300', 'p(99)<800'],
  },
};

function metadata() {
  return ak ? { 'x-usage-ak': ak } : {};
}

function nowIso() {
  return new Date().toISOString();
}

function prefix() {
  return `tl-${__VU}-${__ITER}-${Date.now()}`;
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
  const turnId = `turn-${callPrefix}`;
  const leaseId = `lease-${callPrefix}`;
  const callId = `call-${callPrefix}`;

  const policyResponse = invokeWithDuration('usage.v1.UsageControlService/GetCurrentPolicy', {
    user_id: userId,
    project_id: projectId,
    metric,
  }, { metadata: metadata(), tags: { rpc: 'GetCurrentPolicy', chain: 'turn_lease' } }, policyDuration);
  const policyOk = policyResponse && policyResponse.status === grpc.StatusOK
    && policyResponse.message && policyResponse.message.currentPolicy;
  policySuccessRate.add(!!policyOk);
  if (!policyOk) {
    grpcFailureCount.add(1);
    client.close();
    check(policyResponse, {
      'turn-lease policy status is OK': (res) => res && res.status === grpc.StatusOK,
      'turn-lease policy has payload': (res) => res && res.message && !!res.message.current_policy,
    });
    return;
  }

  const openResponse = invokeWithDuration('usage.v1.UsageControlService/OpenTurnLease', {
    user_id: userId,
    project_id: projectId,
    metric,
    turn_id: turnId,
    lease_id: leaseId,
    idempotency_key: `open-${callPrefix}`,
    lease_ttl_seconds: leaseTtlSeconds,
    metadata: {
      service: 'stress-test',
      mode: 'turn-lease',
      traceId: callPrefix,
      turnId,
    },
  }, { metadata: metadata(), tags: { rpc: 'OpenTurnLease', chain: 'turn_lease' } }, openDuration);
  const openOk = openResponse && openResponse.status === grpc.StatusOK
    && openResponse.message && openResponse.message.opened === true;
  openSuccessRate.add(openOk);
  if (!openOk) {
    grpcFailureCount.add(1);
    client.close();
    check(openResponse, {
      'turn-lease open status is OK': (res) => res && res.status === grpc.StatusOK,
      'turn-lease opened': (res) => res && res.message && res.message.opened === true,
    });
    return;
  }

  const commitResponse = invokeWithDuration('usage.v1.UsageControlService/CommitTurnCallUsage', {
    user_id: userId,
    project_id: projectId,
    metric,
    lease_id: leaseId,
    turn_id: turnId,
    call_id: callId,
    actual_amount: actualAmount,
    idempotency_key: `commit-${callPrefix}`,
    source_type: 'stress_test_turn_call',
    source_id: callId,
    metadata: {
      service: 'stress-test',
      mode: 'turn-lease',
      traceId: callPrefix,
      turnId,
      callId,
    },
    occurred_at: nowIso(),
  }, { metadata: metadata(), tags: { rpc: 'CommitTurnCallUsage', chain: 'turn_lease' } }, commitDuration);
  const commitOk = commitResponse && commitResponse.status === grpc.StatusOK
    && commitResponse.message && commitResponse.message.applied === true;
  commitSuccessRate.add(commitOk);
  if (!commitOk) {
    grpcFailureCount.add(1);
    client.close();
    check(commitResponse, {
      'turn-lease commit status is OK': (res) => res && res.status === grpc.StatusOK,
      'turn-lease commit applied': (res) => res && res.message && res.message.applied === true,
    });
    return;
  }

  const closeResponse = invokeWithDuration('usage.v1.UsageControlService/CloseTurnLease', {
    user_id: userId,
    lease_id: leaseId,
    turn_id: turnId,
    idempotency_key: `close-${callPrefix}`,
  }, { metadata: metadata(), tags: { rpc: 'CloseTurnLease', chain: 'turn_lease' } }, closeDuration);
  const closeOk = closeResponse && closeResponse.status === grpc.StatusOK
    && closeResponse.message && closeResponse.message.closed === true;
  closeSuccessRate.add(closeOk);
  if (!closeOk) {
    grpcFailureCount.add(1);
  }

  check(closeResponse, {
    'turn-lease close status is OK': (res) => res && res.status === grpc.StatusOK,
    'turn-lease close applied': (res) => res && res.message && res.message.closed === true,
  });
  client.close();
}
