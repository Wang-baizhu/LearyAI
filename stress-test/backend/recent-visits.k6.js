// 当前文件职责：使用 k6 对 backend 的 GET /api/visits/recent 接口进行压测。

import http from 'k6/http';
import { check } from 'k6';

const vus = Number(__ENV.BACKEND_VUS || 10);
const duration = __ENV.BACKEND_DURATION || '30s';
const baseUrl = (__ENV.BACKEND_BASE_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');
const recentSize = String(__ENV.BACKEND_RECENT_SIZE || '20');
const cookie = __ENV.BACKEND_SESSION_COOKIE || 'sessionId=test';
const extraHeaders = __ENV.BACKEND_HEADERS_JSON ? JSON.parse(__ENV.BACKEND_HEADERS_JSON) : {};

export const options = {
  vus,
  duration,
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
  },
};

function buildHeaders() {
  const headers = {
    Accept: 'application/json',
    ...extraHeaders,
  };
  if (cookie) {
    headers.Cookie = cookie;
  }
  return headers;
}

export default function () {
  const response = http.get(`${baseUrl}/api/visits/recent?size=${encodeURIComponent(recentSize)}`, {
    headers: buildHeaders(),
    tags: {
      service: 'backend',
      endpoint: 'visits_recent',
    },
  });

  check(response, {
    'recent status is 200': (res) => res.status === 200,
    'recent code is OK': (res) => {
      const body = res.json();
      return body && body.code === 'OK';
    },
  });
}
