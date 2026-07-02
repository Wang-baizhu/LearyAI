# tests/agent_ws 测试说明

## 覆盖范围

当前 `tests/agent_ws/**` 主要覆盖以下能力：

- WebSocket 连接生命周期与消息分发。
- `agent/session/permission/tool` 命令处理。
- 连接鉴权、上下文缓冲、运行时上下文缓存等 WS 专属逻辑。

## 运行前准备

建议在项目根目录先加载 agent 本地环境变量，再执行测试：

```bash
set -a
source .env.agent.local
set +a
```

## 常用运行命令

运行 `agent_ws` 全量测试：

```bash
uv run pytest tests/agent_ws -vv
```

运行单个测试文件：

```bash
uv run pytest tests/agent_ws/test_session_handler.py -vv
```
