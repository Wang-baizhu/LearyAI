# 当前文件职责：统一说明 learyAI 项目的压测脚本目录、运行方式与环境变量约定。

## 目录说明

- `backend/`：Java backend 压测脚本与约束说明，统一使用 `k6`。
- `python-backend/`：Python backend 压测脚本与约束说明，统一使用 `k6`。
- `Tests.md`：当前业务改动对应的压测补充建议与验收指标。

## 运行前准备

1. 安装 `k6`
2. 如需统一使用项目脚本入口，在 `stress-test/` 目录执行 `pnpm install`
3. 启动目标服务
4. 准备鉴权信息

### 统一启动入口

- 推荐通过 `bash stress-test/start.sh <pnpm args...>` 启动。
- 无参数执行 `bash stress-test/start.sh` 时，会顺序执行：
  - `pnpm run stress:backend`
  - `pnpm run stress:python-backend`
- 该脚本会先加载：
  - `python-backend/.env.agent.local`
  - `backend/learyAI/src/main/resources/application.properties`
- `bash stress-test/prepare.sh` 用于压测前自动清理 usage 相关 PostgreSQL/Redis 状态，并重建 stress test 用户额度。
- `prepare.sh` 默认通过 `docker exec` 在容器内执行 `psql` / `redis-cli`，默认容器名分别为 `leary-pg` 和 `leary-redis`。
- `prepare.sh` 的初始化额度通过 `STRESS_TEST_INIT_QUOTA` 控制，不同 usage 场景应传入与场景目标一致的额度，而不是统一写死。
- 若本地容器名不同，可通过 `STRESS_TEST_PG_CONTAINER`、`STRESS_TEST_REDIS_CONTAINER` 覆盖。
- 容器内默认通过 `127.0.0.1` 访问 PG/Redis；若容器内监听地址不同，可通过 `STRESS_TEST_PG_EXEC_HOST`、`STRESS_TEST_REDIS_EXEC_HOST` 覆盖。
- `STRESS_AUTO_PREPARE=1 bash stress-test/start.sh ...` 会在真正执行压测前先自动运行 `prepare.sh`。
- 压测入口默认覆盖 `KIMI_AGENT_WS_TEST_MODE=1`，使 `agent_ws` 使用 mock 鉴权，便于本地直接运行 WebSocket 压测。
- 当 `KIMI_AGENT_WS_TEST_MODE=1` 时，Python backend 的 `agent_ws` 脚本会自动为 WS 握手与 `POST /agent/query` 注入 `x-test-user-id=<__VU>`，确保同一虚拟用户的 WS/HTTP 请求绑定到同一 mock userId。
- `application.properties` 会被转换为 shell 环境变量后再执行 `pnpm`：
  - 例如 `auth.internal.token -> AUTH_INTERNAL_TOKEN`
  - `spring.datasource.url -> SPRING_DATASOURCE_URL`

### backend recent 接口

- 默认脚本：`stress-test/backend/recent-visits.k6.js`
- 默认目标：`GET /api/visits/recent`
- 默认环境变量：
  - `BACKEND_BASE_URL`：默认 `http://127.0.0.1:8080`
  - `BACKEND_RECENT_SIZE`：默认 `20`
  - `BACKEND_SESSION_COOKIE`：默认 `sessionId=test`
  - `BACKEND_HEADERS_JSON`：可选，附加请求头 JSON 字符串
  - `BACKEND_VUS`：默认 `10`
  - `BACKEND_DURATION`：默认 `30s`

运行示例：

```bash
bash stress-test/start.sh
```

或只运行 backend：

```bash
BACKEND_BASE_URL=http://127.0.0.1:8080 \
BACKEND_VUS=20 \
BACKEND_DURATION=1m \
bash stress-test/start.sh run stress:backend
```

### python-backend agent 会话链路

- 默认脚本：`stress-test/python-backend/agent-ws-session-query.k6.js`
- 默认目标：`ws 建连 -> session.create -> 可选 session.context -> 同一 session 串行两次 POST /agent/query`
- 默认环境变量：
  - `AGENT_WS_URL`：默认 `ws://127.0.0.1:8081/agent/ws`
  - `AGENT_QUERY_URL`：可选；默认由 `AGENT_WS_URL` 自动推导为同宿主的 `http://.../agent/query`
  - `AGENT_WS_PROJECT_ID`：默认 `11111111-1111-1111-1111-111111111111`，会透传到 `session.create` 与 `POST /agent/query`
  - `AGENT_WS_KB_ID`：可选，会透传到 `session.create` 与 `POST /agent/query`
  - `AGENT_WS_SESSION_COOKIE`：可选；压测默认走 mock 鉴权时可不传
  - `AGENT_WS_REQUEST_CONTEXT_ON_CREATE`：默认 `1`；为 `1` 时会在 `session.create` 后先请求 `session.context`
  - `AGENT_WS_DOC_REFS_JSON`：可选，JSON 数组字符串，会透传到 `POST /agent/query`
  - `AGENT_WS_DOC_ID`：可选；若未传 `AGENT_WS_DOC_REFS_JSON`，会降级组装为 `docRefs=[{id}]`
  - `AGENT_WS_VUS`：默认 `5`
  - `AGENT_WS_ITERATIONS`：默认 `5`
  - `AGENT_WS_TIMEOUT_MS`：默认 `15000`

运行示例：

```bash
AGENT_WS_URL=ws://127.0.0.1:8081/agent/ws \
AGENT_QUERY_URL=http://127.0.0.1:8081/agent/query \
AGENT_WS_PROJECT_ID=11111111-1111-1111-1111-111111111111 \
AGENT_WS_DOC_REFS_JSON='[{"id":"doc-xxx","name":"需求文档"}]' \
AGENT_WS_VUS=10 \
AGENT_WS_ITERATIONS=20 \
bash stress-test/start.sh run stress:python-backend
```

## 结果观察

- `backend`：重点观察状态码、`http_req_duration`、P95/P99、失败率。
- `python-backend`：重点观察 WebSocket 握手成功率、`session:created` / `session:context` 成功率、HTTP `202 accepted` 比例、`agent.result` 完成率、超时率。
- 对 usage 场景，需区分“HTTP 是否 accepted”和“最终是否通过 WebSocket `agent.result/error` 收敛到预期业务结果”；`202 accepted` 不代表 usage 未拒绝，只代表 query 已进入执行链路。
- 服务端建议同时观察：
  - backend：`/actuator/prometheus`、数据库连接池、慢查询
  - python-backend：`/metrics`、Redis/PG 连接数、agent_ws 日志

## 历史观察

- 旧版 `agent_ws` JMeter 压测曾观察到：约 `20` 个并发连接时，瓶颈更偏向数据库读写而不是 CPU 与内存。
- 该历史结论已不再保留旧脚本格式，后续应基于当前 `k6` 脚本重新复测并更新结果。
