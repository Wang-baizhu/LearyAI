# wire 模块职责说明

## 概览
- `kimi_cli.wire` 是 Soul 与外部 ACP/Wire 客户端之间的通信层，负责：  
  1. 定义所有可传递的事件/请求类型；  
  2. 接管 `Wire` 通道的消息流并提供可选的关账录制；  
  3. 在 CLI 模式下通过 JSON-RPC（Wire Server）与 ACP 客户端交互；  
  4. 对 Wire 数据落盘（JSONL）提供读写与版本管理接口。

## 各文件职责

### `__init__.py`
- 组装 `Wire` 通道：创建 soul/merged 队列、控制合并机制、提供 soul/ui 双向视图。  
- 可选接入 `_WireRecorder`，将已经合并的消息异步写入 `WireFile`；与 `store` 层解耦是该文件首要作用。  
- 暴露 `WireSoulSide` / `WireUISide` 供上层驱动，确保消息在多个订阅者之间流动。
- `_WireRecorder` 会依据 `KIMI_TURN_MODE` 决定是否把当前 turn 写入独立的 turn recording 文件；`record` 模式写入 `KIMI_TURN_RECORD_ROOT/output/record/replay.jsonl`，`normal`/`replay` 不写入。

### `file.py`
- 充当 `wire.jsonl` 的操作接口；使用 `get_wire_store()` 访问底层 store，实现：  
  * 读取协议版本并初始化 `WireFile`；  
  * 检查文件是否为空；  
  * 迭代 records / 追加消息（自动转换为 `WireMessageRecord`）。  
- 把协议常量和 record 序列化逻辑封装，使业务逻辑无需直接触碰 store 细节。

### `jsonrpc.py`
- 定义 Wire Server 所用的 JSON-RPC 消息模型，包括 `initialize`、`prompt`、`cancel` 等 inbound/ outbound 类型；  
- 提供 `JSONRPCMessage`、`JSONRPCSuccess/Error/Request/Event` 等结构的验证、序列化 helper；  
- 附带预定义错误码（`ErrorCodes`）和结果状态（`Statuses`），以便 `server.py` 使用。

### `protocol.py`
- 单纯的常量模块，定义当前 Wire 协议版本（`WIRE_PROTOCOL_VERSION` / `WIRE_PROTOCOL_LEGACY_VERSION`），  
 供 `file.py`、`record.py` 等用来读写 metadata header。

### `record.py`
- 定义 `WireFileMetadata`（后续 JSONL 文件第一行）与 `WireMessageRecord`（时间戳 + payload）；  
- 提供 `from_wire_message`/`to_wire_message` 互转、JSON 类型的 `parse_wire_file_line`、`dump_wire_line` 工具；  
- 提供 `load_protocol_version` / `default_protocol_version_for_path` 供 `WireFile` 初始化和存储层读取。

### `turn_record.py`
- 定义 turn recording 文件的持久化结构，保存单个 `TurnBegin -> TurnEnd` 区间内的完整 wire 消息。
- 提供固定 turn recording 文件路径 `KIMI_TURN_RECORD_ROOT/output/record/replay.jsonl`、追加写入、读取与取最新 turn 的工具。

### `serde.py`
- 把 `WireMessage` 与 JSON dict 的转换独立出来：  
  * `serialize_wire_message`：利用 `WireMessageEnvelope` 生成可序列化 payload；  
  * `deserialize_wire_message`：反向构建 `WireMessage`；  
- 供 JSON-RPC/record 模块共享（避免重复构建 envelope 逻辑）。

### `server.py`
- Wire 模式下的业务入口：建立 stdin/stdout 的 JSON-RPC 连接、读取外部请求、响应事件等；  
- 负责：  
  * ACP/JSON-RPC message 验证、错误处理、dispatch；  
  * 与 `Soul` 交互（`run_soul`、prompt/cancel/upstream events）；  
  * 将 `ApprovalRequest`、`ToolCallRequest` 代理到客户端、等待其 JSON-RPC 回复并 resolve；  
  * 在 shutdown 时清理挂起请求、取消事件。  
- 同时维护 `_pending_requests`、`_cancel_event`、`_write_queue` 等状态，由 JSON-RPC Adapter 和 `Wire` 的流式消息协同工作。

### `types.py`
- 定义 Wire 所有消息类型（event/request）与字段：  
  * 事件类包括 `TurnBegin`、`StepBegin`、`StatusUpdate`、`DisplayBlock` 相关等；  
  * 请求类包括 `ApprovalRequest`、`ToolCallRequest`（附带 `future` 机制）；  
  * `WireMessageEnvelope` 用于 `serde`/`record` 将消息名字与 payload 对应；  
  * 提供 `is_event/request/wire_message` 及 TypeGuard，方便类型判定；  
  * `ApprovalResponse`、`SubagentEvent`、`ToolCallRequest.from_tool_call` 等辅助逻辑。  
- 该文件是 Wire 结构的中心定义，对外暴露所有 type 供 `soul`/`server`/`wire` 复用。

### `json_schema.py`
- 从运行时 `WireMessage` Pydantic 模型导出 JSON Schema，作为前端协议类型生成的后端单一事实源。  
- `scripts/schema/gen_json_schema_from_backend.py` 会读取该文件并生成 `schema/agent/wire.schema.json`。  
- 前端 TS 类型统一通过 `scripts/schema/gen_agent_wire_ts.sh` 从 JSON Schema 生成，避免前后端各自维护一套字段定义。
