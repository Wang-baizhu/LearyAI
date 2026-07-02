# 该文件职责：验证 tasks_server MQ 消息解析与字段归一化逻辑。

from __future__ import annotations

import unittest

try:
    from tasks_server.mq.generated_contracts import AgentRunCommand
    from tasks_server.mq.schema import PayloadError, parse_payload, parse_task_payload
except ModuleNotFoundError as exc:
    if exc.name in {"pydantic", "jsonschema"}:
        AgentRunCommand = None  # type: ignore[assignment]
        PayloadError = None  # type: ignore[assignment]
        parse_payload = None  # type: ignore[assignment]
        parse_task_payload = None  # type: ignore[assignment]
    else:
        raise


@unittest.skipIf(AgentRunCommand is None or parse_task_payload is None, "tasks_server schema deps not installed")
class TaskMqSchemaTests(unittest.TestCase):
    # 测试内容：parse_payload 能解析合法 JSON。
    def test_parse_payload_success(self) -> None:
        body = b'{"taskRecordId": 1, "projectId": "p1"}'

        parsed = parse_payload(body)

        self.assertEqual(parsed["taskRecordId"], 1)
        self.assertEqual(parsed["projectId"], "p1")

    # 测试内容：非法 JSON 会抛出统一 PayloadError。
    def test_parse_payload_invalid_json(self) -> None:
        with self.assertRaisesRegex(PayloadError, "invalid json payload"):
            parse_payload(b"{invalid")

    # 测试内容：统一 agent command envelope 会被正确提取并归一化。
    def test_parse_task_payload_normalizes_nested_fields(self) -> None:
        raw = {
            "messageId": "m-1",
            "projectId": "project-1",
            "kbId": "kb-1",
            "taskRecordId": 42,
            "stageRunKey": "agent:summary",
            "taskType": "agent",
            "schemaVersion": "1.0",
            "occurredAt": "2026-04-19T00:00:00Z",
            "traceId": "trace-1",
            "producer": "backend",
            "userId": 7,
            "payload": {
                "typeId": "t-1",
                "agentTaskType": "kbsummary",
                "extraInfo": "docs=1;templates=2",
                "agentSessionId": "sess-1",
                "modelConfigType": "default",
                "docRefs": [
                    {"id": "doc-1", "name": "Doc 1"},
                    {"id": "doc-2"},
                ],
            },
        }

        payload = parse_task_payload(raw)

        self.assertIsInstance(payload, AgentRunCommand)
        self.assertEqual(payload.task_record_id, 42)
        self.assertEqual(payload.project_id, "project-1")
        self.assertEqual(payload.parent_task_record_id, None)
        self.assertEqual(payload.stage_run_key, "agent:summary")
        self.assertEqual(payload.payload.agent_task_type, "kbsummary")
        self.assertEqual(payload.payload.extra_info, "docs=1;templates=2")
        self.assertEqual(payload.payload.agent_session_id, "sess-1")
        self.assertEqual(payload.payload.model_config_type, "default")
        self.assertEqual(payload.user_id, 7)
        self.assertEqual(payload.kb_id, "kb-1")
        self.assertEqual(payload.task_type, "agent")
        self.assertEqual(payload.payload.type_id, "t-1")
        self.assertEqual(payload.message_id, "m-1")
        self.assertEqual(payload.trace_id, "trace-1")
        self.assertEqual(
            [doc.model_dump(mode="python") for doc in payload.payload.doc_refs],
            [
                {"id": "doc-1", "name": "Doc 1"},
                {"id": "doc-2", "name": None},
            ],
        )

    # 测试内容：保留 parentTaskRecordId 和 stageRunKey 以支持阶段追踪。
    def test_parse_task_payload_keeps_stage_context(self) -> None:
        raw = {
            "messageId": "m-2",
            "schemaVersion": "1.0",
            "occurredAt": "2026-04-19T00:00:00Z",
            "traceId": "trace-2",
            "producer": "backend",
            "projectId": "project-2",
            "kbId": "kb-2",
            "taskRecordId": 77,
            "parentTaskRecordId": 66,
            "stageRunKey": "agent:template:plugin-2",
            "taskType": "agent",
            "payload": {
                "agentTaskType": "template",
                "pluginId": "plugin-2",
            },
        }

        payload = parse_task_payload(raw)

        self.assertIsInstance(payload, AgentRunCommand)
        self.assertEqual(payload.parent_task_record_id, 66)
        self.assertEqual(payload.stage_run_key, "agent:template:plugin-2")

    # 测试内容：taskType 非 agent 时拒绝消费。
    def test_parse_task_payload_rejects_non_agent_task_type(self) -> None:
        raw = {
            "messageId": "m-1",
            "schemaVersion": "1.0",
            "occurredAt": "2026-04-19T00:00:00Z",
            "traceId": "trace-1",
            "producer": "backend",
            "projectId": "p1",
            "kbId": "kb-1",
            "taskRecordId": 99,
            "stageRunKey": "agent:summary",
            "taskType": "doc",
            "payload": {
                "agentTaskType": "kbsummary",
            },
        }

        with self.assertRaisesRegex(PayloadError, "taskType must be agent"):
            parse_task_payload(raw)

    # 测试内容：缺少 taskRecordId 时会抛出明确错误。
    def test_parse_task_payload_requires_task_id(self) -> None:
        raw = {
            "messageId": "m-1",
            "schemaVersion": "1.0",
            "occurredAt": "2026-04-19T00:00:00Z",
            "traceId": "trace-1",
            "producer": "backend",
            "projectId": "p1",
            "kbId": "kb-1",
            "stageRunKey": "agent:summary",
            "taskType": "agent",
            "payload": {
                "agentTaskType": "kbsummary",
            },
        }

        with self.assertRaisesRegex(PayloadError, "taskRecordId required"):
            parse_task_payload(raw)

    # 测试内容：缺少 projectId 时会抛出明确错误。
    def test_parse_task_payload_requires_project_id(self) -> None:
        raw = {
            "messageId": "m-1",
            "schemaVersion": "1.0",
            "occurredAt": "2026-04-19T00:00:00Z",
            "traceId": "trace-1",
            "producer": "backend",
            "kbId": "kb-1",
            "taskRecordId": 1,
            "stageRunKey": "agent:summary",
            "taskType": "agent",
            "payload": {
                "agentTaskType": "kbsummary",
            },
        }

        with self.assertRaisesRegex(PayloadError, "projectId required"):
            parse_task_payload(raw)

    # 测试内容：pptprompt 允许 projectId 与 kbId 为空，避免无 KB 任务写入伪造 scope。
    def test_parse_task_payload_allows_empty_scope_for_pptprompt(self) -> None:
        raw = {
            "messageId": "m-ppt",
            "schemaVersion": "1.0",
            "occurredAt": "2026-04-19T00:00:00Z",
            "traceId": "trace-ppt",
            "producer": "backend",
            "taskRecordId": 1,
            "stageRunKey": "agent:pptprompt",
            "taskType": "agent",
            "payload": {
                "agentTaskType": "pptprompt",
                "promptVars": {
                    "PROMPT_MARKDOWN": "body_1: 第一段",
                },
            },
        }

        payload = parse_task_payload(raw)

        self.assertIsNone(payload.project_id)
        self.assertIsNone(payload.kb_id)

    # 测试内容：缺少 agentTaskType 时会抛出明确错误。
    def test_parse_task_payload_requires_agent_task_type(self) -> None:
        raw = {
            "messageId": "m-1",
            "schemaVersion": "1.0",
            "occurredAt": "2026-04-19T00:00:00Z",
            "traceId": "trace-1",
            "producer": "backend",
            "projectId": "p1",
            "kbId": "kb-1",
            "taskRecordId": 1,
            "stageRunKey": "agent:summary",
            "taskType": "agent",
            "payload": {
                "typeId": "x",
            },
        }

        with self.assertRaisesRegex(PayloadError, "payload.agentTaskType required"):
            parse_task_payload(raw)

    # 测试内容：模板型 agent task 通过 pluginId 指定 manifest，统一映射到 creator 入口。
    def test_parse_task_payload_allows_flow_task_without_prompt(self) -> None:
        raw = {
            "messageId": "m-3",
            "schemaVersion": "1.0",
            "occurredAt": "2026-04-19T00:00:00Z",
            "traceId": "trace-3",
            "producer": "backend",
            "projectId": "project-1",
            "kbId": "kb-1",
            "taskRecordId": 8,
            "stageRunKey": "agent:template:plugin-1",
            "taskType": "agent",
            "payload": {
                "agentTaskType": "template",
                "pluginId": "plugin-1",
                "promptVars": {
                    "focus": "绪论",
                },
            },
        }

        payload = parse_task_payload(raw)

        self.assertIsInstance(payload, AgentRunCommand)
        self.assertEqual(payload.payload.agent_task_type, "template")
        self.assertEqual(payload.payload.plugin_id, "plugin-1")
        self.assertEqual(payload.payload.prompt_vars, {"focus": "绪论"})

    # 测试内容：stageRunKey 与 agentTaskType 不匹配时直接拒绝。
    def test_parse_task_payload_requires_matching_stage_run_key(self) -> None:
        raw = {
            "messageId": "m-5",
            "schemaVersion": "1.0",
            "occurredAt": "2026-04-19T00:00:00Z",
            "traceId": "trace-5",
            "producer": "backend",
            "projectId": "project-1",
            "kbId": "kb-1",
            "taskRecordId": 9,
            "stageRunKey": "agent:template:plugin-1",
            "taskType": "agent",
            "payload": {
                "agentTaskType": "template",
                "pluginId": "plugin-2",
            },
        }

        with self.assertRaisesRegex(PayloadError, "stageRunKey invalid"):
            parse_task_payload(raw)

    # 测试内容：promptVars 非对象时直接报错，避免非法变量结构进入渲染阶段。
    def test_parse_task_payload_rejects_invalid_prompt_vars(self) -> None:
        raw = {
            "messageId": "m-4",
            "schemaVersion": "1.0",
            "occurredAt": "2026-04-19T00:00:00Z",
            "traceId": "trace-4",
            "producer": "backend",
            "projectId": "project-1",
            "kbId": "kb-1",
            "taskRecordId": 8,
            "stageRunKey": "agent:template:plugin-1",
            "taskType": "agent",
            "payload": {
                "agentTaskType": "template",
                "pluginId": "plugin-1",
                "promptVars": ["focus"],
            },
        }

        with self.assertRaisesRegex(PayloadError, "payload.promptVars invalid"):
            parse_task_payload(raw)

    # 测试内容：kbview 模板任务应映射到 agent:kbview 阶段。
    def test_parse_task_payload_supports_kbview_flow(self) -> None:
        raw = {
            "messageId": "m-6",
            "schemaVersion": "1.0",
            "occurredAt": "2026-04-19T00:00:00Z",
            "traceId": "trace-6",
            "producer": "backend",
            "projectId": "project-1",
            "kbId": "kb-1",
            "taskRecordId": 10,
            "stageRunKey": "agent:kbview",
            "taskType": "agent",
            "payload": {
                "agentTaskType": "kbview",
                "promptVars": {
                    "focus": "主题关系",
                },
            },
        }

        payload = parse_task_payload(raw)

        self.assertIsInstance(payload, AgentRunCommand)
        self.assertEqual(payload.stage_run_key, "agent:kbview")
        self.assertEqual(payload.payload.agent_task_type, "kbview")
        self.assertEqual(payload.payload.prompt_vars, {"focus": "主题关系"})

    # 测试内容：search agent task 应映射到 agent:search 阶段。
    def test_parse_task_payload_supports_search_flow(self) -> None:
        raw = {
            "messageId": "m-7",
            "schemaVersion": "1.0",
            "occurredAt": "2026-04-19T00:00:00Z",
            "traceId": "trace-7",
            "producer": "backend",
            "projectId": "project-1",
            "kbId": "kb-1",
            "taskRecordId": 11,
            "stageRunKey": "agent:search",
            "taskType": "agent",
            "payload": {
                "agentTaskType": "search",
                "promptVars": {
                    "CONTENT_TO_EXPLORER": "什么是RAG",
                },
            },
        }

        payload = parse_task_payload(raw)

        self.assertIsInstance(payload, AgentRunCommand)
        self.assertEqual(payload.stage_run_key, "agent:search")
        self.assertEqual(payload.payload.agent_task_type, "search")
        self.assertEqual(payload.payload.prompt_vars, {"CONTENT_TO_EXPLORER": "什么是RAG"})

    # 测试内容：模板任务缺少 pluginId 时应直接拒绝。
    def test_parse_task_payload_requires_plugin_id_for_template(self) -> None:
        raw = {
            "messageId": "m-8",
            "schemaVersion": "1.0",
            "occurredAt": "2026-04-19T00:00:00Z",
            "traceId": "trace-8",
            "producer": "backend",
            "projectId": "project-1",
            "kbId": "kb-1",
            "taskRecordId": 12,
            "stageRunKey": "agent:template:plugin-1",
            "taskType": "agent",
            "payload": {
                "agentTaskType": "template",
            },
        }

        with self.assertRaisesRegex(PayloadError, "payload.pluginId required"):
            parse_task_payload(raw)

    # 测试内容：extraInfo 非字符串时直接报错，避免非法上下文进入 system prompt。
    def test_parse_task_payload_rejects_invalid_extra_info(self) -> None:
        raw = {
            "messageId": "m-9",
            "schemaVersion": "1.0",
            "occurredAt": "2026-04-19T00:00:00Z",
            "traceId": "trace-9",
            "producer": "backend",
            "projectId": "project-1",
            "kbId": "kb-1",
            "taskRecordId": 13,
            "stageRunKey": "agent:kbview",
            "taskType": "agent",
            "payload": {
                "agentTaskType": "kbview",
                "extraInfo": {"docs": 2},
            },
        }

        with self.assertRaisesRegex(PayloadError, "payload.extraInfo invalid"):
            parse_task_payload(raw)


if __name__ == "__main__":
    unittest.main()
