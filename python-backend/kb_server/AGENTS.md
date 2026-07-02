# kb_server 模块说明

## 模块目标
`kb_server` 提供两类能力：
1. 基于 FastAPI 的 RAG HTTP 接口（`/rag/*`）。
2. 基于 RabbitMQ 的文档任务消费与处理（下载文档、入库、渲染、发布任务状态）。

## 当前分层（重构后）

### 1) API 层（`api/`）
- `rag_models.py`：HTTP 请求模型定义（Pydantic）。
- `rag_routes.py`：路由定义与 HTTP 错误映射。
- 约束：仅处理协议层（请求校验、状态码转换），不写业务编排。

### 2) Application 层（`application/`）
- `rag_service.py`：RAG 相关应用服务，封装 `knowledge_base` 根级导出方法调用。
- `doc_task_service.py`：文档任务编排服务，采用依赖注入（`DocTaskDependencies`），负责文档步骤级幂等与完成元数据准备，不直接发布 DONE 事件。

### 3) Infrastructure 层（`infrastructure/`）
- `consumer_lifecycle.py`：MQ 消费者启停管理（供 `server.py` 的 lifespan 调用，兼容 `on_event` 挂载）。
- `db.py`：KB 数据库访问。
- `notifier.py`：任务状态通知（发布 `task.event.status.changed`）。
- `packages/task_events`：公共 outbox + publisher；`notifier.py` 通过它把 doc DONE 事件先写入 PostgreSQL，再异步发布到 RabbitMQ。
- `dependencies.py`：文档任务默认依赖装配。
- `document/convert.py`：文件转 PDF。
- `document/render.py`：PDF 渲染为图片。
- `storage/object_storage.py`：对象存储下载与上传（Minio/OSS）。
- `mq/doc_consumer.py`：RabbitMQ 消费者。
- `mq/doc_task.py`：文档任务入口（委托 application 服务）。
- `mq/task_status_producer.py`：任务状态 MQ 发布器（`task.event.status.changed`）。

### 4) 入口层
- `server.py`：应用装配入口（约 20~30 行，保持薄）。
- `process_doc.py`：仅启动文档消费者。
- `tools.py`：兼容导出（转发 API 路由函数与模型）。

### 5) 测试层（`tests/`）
- `test_doc_task_service.py`：文档任务编排单测（外部依赖 fake）。
- `test_http_routes.py`：FastAPI 路由契约测试（字段级断言）。
  - 若当前环境缺少 `fastapi`，该组测试会自动 skip。

## 主要调用链路

### HTTP RAG 请求链路
`server.py -> api/rag_routes.py -> application/rag_service.py -> knowledge_base`

### 文档任务消费链路
`infrastructure/mq/doc_consumer.py -> infrastructure/mq/doc_task.py -> application/doc_task_service.py -> infrastructure/*`
状态更新约束：文档任务状态由 `notifier.py` 背后的 `task_events` runtime 通过 MQ 发布到 `task.event.status.changed`；后续是否触发 agent 任务由 backend 编排决定。
- `doc_task_service.py` 里的 `processingState` 继续负责文档步骤级幂等与断点恢复；MQ 状态送达可靠性由 `task_events` outbox 负责。
- `processingState.finalize.state=pending` 表示文档内容已处理完并生成稳定完成消息 ID，但 DONE 事件与 execution completed 还需由 consumer 通过原子 store 调用一并提交；只有原子提交成功后才会回写 `done`。
- 文档任务执行去重 lease 由 consumer 在处理期间后台续约，默认读取 `TASK_EXECUTION_LEASE_SECONDS`，避免长耗时 PDF/切片/上传任务在执行中途失去租约。
- consumer 仅接受新 MQ envelope；若 JSON 可解但 envelope 非法，只做 reject 进入 DLQ，不在 worker 侧直接回发 `doc FAILED`。
- 文档任务每次重试都会把最后一次异常写入 `x-last-error-*` headers，供 backend DLQ consumer 统一补发标准 `FAILED` 事件。
- 文档入库约束：
  - PDF/版式文档走 `knowledge_base.store_pdf()`。
  - 纯文本来源可走 `knowledge_base.store_text()`，由 `knowledge-base` 内部按固定规则切割后入库。
  - `payload.sourceType=text` 时直接把 `payload.source` 作为正文入库，不再经过对象存储下载或 PDF 渲染。
  - 音频来源默认会把 FunASR 分段转成带 `[HH:MM:SS-HH:MM:SS]` 时间戳的文本后再入库。
  - URL 来源统一在 `infrastructure/document/preprocess/` 内处理：先尝试字幕提取，失败后回退音频下载并复用 ASR。

## 关键环境变量

### 服务启动
- `KIMI_KB_HOST`：HTTP 监听地址，默认 `127.0.0.1`
- `KIMI_KB_PORT`：HTTP 端口，默认 `8001`
- `LOG_LEVEL`：日志级别，默认 `info`
- `LOG_FORMAT`：日志格式，支持 `text/json`，默认 `text`
- `LOG_TO_STDOUT`：是否输出到控制台（`1/0`），默认 `1`
- `LOG_FILE`：日志文件路径，留空表示不写文件
- `KIMI_KB_METRICS_ENABLED`：是否启用文档消费者独立 metrics 端口（默认 `1`）
- `KIMI_KB_METRICS_HOST`：文档消费者 metrics 监听地址，默认 `127.0.0.1`
- `KIMI_KB_METRICS_PORT`：文档消费者 metrics 端口，默认 `8022`
- `KIMI_KB_MQ_ENABLED`：是否启用 MQ 消费者（`1/0`）
  - 默认行为：`python server.py` 会同时启动 HTTP 与 MQ 消费者。
  - 当值为 `0`/`false`/`no` 时：`server.py` 仅启动 HTTP，不启动消费者。
  - 若需单独运行消费者：使用 `python process_doc.py`。

### MQ
- `KB_MQ_HOST` `KB_MQ_PORT` `KB_MQ_USERNAME` `KB_MQ_PASSWORD` `KB_MQ_VHOST`
- `TASK_MQ_EXCHANGE` `TASK_MQ_DOC_PROCESS_QUEUE` `TASK_MQ_DOC_PROCESS_ROUTING_KEY`
- `TASK_MQ_DOC_PROCESS_RETRY_ROUTING_KEY` `TASK_MQ_DOC_PROCESS_MAX_RETRIES`
- `TASK_MQ_STATUS_EVENT_ROUTING_KEY`（任务状态发布路由，默认 `task.event.status.changed`）

### 文档任务消息关键字段
- `messageId` `traceId`
- `projectId` `kbId` `taskRecordId` `taskType`
- `parentTaskRecordId` `stageRunKey`
- `payload.typeId`
- `payload.sourceType` `payload.source`
- 兼容旧消息：`payload.objectKey`
- 状态事件顶层字段包含 `status`, `changeType`, `info`, `result`, `errorCode`, `errorMessage`；这些字段只用于 backend 回写阶段事实，父任务对外失败展示统一收敛到 `viewData.failedReason`

### 数据库（KB）
- `KB_PG_DSN`（优先，示例：`postgresql+psycopg2://user:password@host:5432/db`）
- 兼容拆分变量：`KB_PG_HOST` `KB_PG_PORT` `KB_PG_USER` `KB_PG_PASSWORD` `KB_PG_DATABASE`

### 存储
- `KB_STORAGE_PROVIDER`：`minio`/`oss`
- Minio: `KB_STORAGE_MINIO_ENDPOINT` `KB_STORAGE_MINIO_BUCKET` `KB_STORAGE_MINIO_ACCESS_KEY` `KB_STORAGE_MINIO_SECRET_KEY`
- OSS: `KB_STORAGE_OSS_ENDPOINT` `KB_STORAGE_OSS_BUCKET` `KB_STORAGE_OSS_ACCESS_KEY_ID` `KB_STORAGE_OSS_ACCESS_KEY_SECRET`

### 文档转换
- `KB_SOFFICE_PATH`：LibreOffice `soffice` 路径
- `KB_FUNASR_MODEL`：FunASR 主模型，默认 `paraformer-zh`
- `KB_FUNASR_VAD_MODEL`：FunASR VAD 模型，默认 `fsmn-vad`
- `KB_FUNASR_PUNC_MODEL`：FunASR 标点模型，默认 `ct-punc`
- `KB_FUNASR_DEVICE`：FunASR 推理设备，默认自动选择 `cuda:0` 或 `cpu`
- `KB_FUNASR_HUB`：模型仓库来源，默认 `ms`
- `KB_FUNASR_SENTENCE_TIMESTAMP`：是否请求 FunASR 产出句级时间戳，默认 `true`
- `KB_BILIBILI_COOKIE`：B 站字幕提取与音频下载时注入的完整 Cookie 字符串；当 URL 来源存在字幕时，会优先抓取字幕 JSON 并按 `[HH:MM:SS-HH:MM:SS] 文本` 形式入库，否则回退给 `yt_dlp` 下载音频

## 开发约定
1. 新功能优先放入 `api/application/infrastructure` 对应层，不再新增 `utils` 杂项模块。
2. `server.py` 只做装配，不承载业务逻辑。
3. application 层禁止直接依赖具体外部客户端（DB/HTTP/MQ/存储），通过依赖注入隔离。
4. 文档来源获取（对象存储下载、URL 字幕提取、URL 音频下载）统一放在 `infrastructure/document/preprocess/`，不要回流到 `DocTaskService` 或 `storage`。
5. 路由层异常映射保持稳定：
   - 普通异常 -> HTTP 500
   - `update_doc_info` 的 `ValueError` -> `{ "success": false, "error": ... }`
6. 文件顶部注释需明确“当前文件职责”。

## 本地开发与验证
- 运行测试：
  - `python -m unittest discover -s tests -p "test_*.py"`
- RAG 真实接口集成测试（默认跳过，需显式开启）：
  - 环境变量：
    - `KIMI_KB_IT_ENABLED=1`：开启集成测试
    - `KIMI_KB_IT_BASE_URL`：服务地址，默认 `http://127.0.0.1:8001`
    - `KIMI_KB_IT_DOC_ID`：真实文档 ID（必填）
    - `KIMI_KB_IT_TIMEOUT`：请求超时秒数，默认 `10`
  - 运行命令：
    - `python -m unittest tests.test_rag_integration -v`
- 编译检查：
  - `python -m compileall api application infrastructure server.py process_doc.py tools.py`
- 启动服务：
  - `python server.py`
- 启动 MQ 消费者：
  - `python process_doc.py`

## 监控指标（Prometheus）
- HTTP 服务指标：`GET /metrics`（随 `server.py` 一起启动）
- 文档消费者指标：默认 `127.0.0.1:8022/metrics`（随消费者启动）
- 文档消费者独立 metrics 端口在同一进程内只启动一次，重复调用会直接复用既有实例，不再重复抢占端口。
- 关键指标：
  - `kb_server_http_requests_total`
  - `kb_server_http_request_duration_seconds`
  - `kb_server_doc_tasks_total`
  - `kb_server_doc_task_duration_seconds`
  - `kb_server_doc_tasks_inflight`

## 后续建议
1. 若 `tools.py` 不再被外部依赖，可在下个版本删除兼容导出层。
2. 为 `infrastructure/mq` 与 `infrastructure/storage` 增加组件测试（mock 服务）。
3. 对任务失败码与可观测日志格式做统一规范（error_code + context）。
