# 当前目录职责：存放 Python backend 压测脚本与该目录下的维护约束。

## 范围

- 仅放置面向 `python-backend` 服务的压测脚本与配套说明。
- 当前统一使用 `k6`，包括 WebSocket 链路压测。

## 脚本约束

- 一个脚本只描述一条完整链路，例如 `ws 建连 -> session.create -> POST /agent/query`。
- 脚本文件名应体现协议与目标，例如 `agent-ws-session-query.k6.js`。
- 脚本顶部必须使用注释说明职责。
- 默认参数通过环境变量注入，不要把真实 `sessionId`、真实文档 ID、真实域名写死在脚本中。

## WebSocket 约束

- `agent_ws` 压测脚本必须显式校验握手成功。
- 需要明确等待的关键事件，例如 `session:created`、`session:context`、`agent.result`、`error`。
- 超时行为必须可配置，并在超时时让失败暴露出来，不能静默吞掉。

## HTTP Query 约束

- query 提交统一走 `POST /agent/query`，禁止继续通过 WebSocket 发送 `agent.query`。
- 需要显式校验 HTTP 是否返回 `202 accepted`，并把入口拒绝与执行期 WebSocket `error` 分开统计。
