# 该文件职责：验证 tasks_server 任务编排在成功与失败路径下的状态通知和结果封装逻辑。

from __future__ import annotations

import asyncio
import unittest
from unittest.mock import AsyncMock, patch

from tasks_server.config import MqConfig, RuntimeConfig
try:
    from tasks_server.mq.generated_contracts import (
        AgentPayload,
        AgentRunCommand,
    )
except ModuleNotFoundError as exc:
    if exc.name == "pydantic":
        AgentPayload = None  # type: ignore[assignment]
        AgentRunCommand = None  # type: ignore[assignment]
    else:
        raise
try:
    from tasks_server.runtime.executor import TaskResult
except ModuleNotFoundError as exc:
    if exc.name in {"kosong", "kimi_cli", "usage_control"}:
        TaskResult = None  # type: ignore[assignment]
    else:
        raise
try:
    from tasks_server.task.errors import TaskErrorCode, TaskErrorDetail, TaskError
except ModuleNotFoundError as exc:
    if exc.name in {"kosong", "prometheus_client"}:
        TaskErrorCode = None  # type: ignore[assignment]
        TaskErrorDetail = None  # type: ignore[assignment]
        TaskError = None  # type: ignore[assignment]
    else:
        raise
try:
    from tasks_server.task.handler import handle_task_payload
except ModuleNotFoundError as exc:
    if exc.name in {"prometheus_client", "kosong", "kimi_cli", "usage_control"}:
        handle_task_payload = None  # type: ignore[assignment]
    else:
        raise


def _build_payload() -> AgentRunCommand:
    return AgentRunCommand(
        messageId="m-1",
        schemaVersion="1.0",
        occurredAt="2026-04-19T00:00:00Z",
        traceId="trace-1",
        producer="backend",
        projectId="project-1",
        kbId="kb-1",
        userId=7,
        taskRecordId=101,
        taskType="agent",
        parentTaskRecordId=88,
        stageRunKey="agent:summary",
        payload=AgentPayload(
            typeId="t-1",
            agentTaskType="kbsummary",
            promptVars={},
            agentSessionId="session-1",
            modelConfigType="default",
            docRefs=[{"id": "doc-1", "name": "Alpha"}],
            extraInfo=None,
        ),
        raw={"taskRecordId": 101},
    )


def _build_runtime() -> RuntimeConfig:
    return RuntimeConfig(
        cwd="/tmp/tasks-server-tests",
        mode="normal",
        auto_approve=True,
        tool_call_mode="error",
        frontend_base_url="",
        task_timeout_seconds=1500,
    )


def _build_mq() -> MqConfig:
    return MqConfig(
        enabled=True,
        host="127.0.0.1",
        port=5672,
        username="guest",
        password="guest",
        vhost="/",
        exchange="task.exchange",
        queue="task.agent.run.queue",
        routing_key="task.command.agent.run",
        retry_routing_key="task.command.agent.run.retry",
        max_retries=3,
        prefetch_count=50,
        status_routing_key="task.event.status.changed",
    )


@unittest.skipIf(
    AgentPayload is None or AgentRunCommand is None or TaskResult is None or TaskError is None or handle_task_payload is None,
                 "tasks_server runtime deps not installed")
class TaskHandlerTests(unittest.TestCase):
    def setUp(self) -> None:
        self._logger_patcher = patch("tasks_server.task.handler.logger")
        self._logger_patcher.start()
        self.addCleanup(self._logger_patcher.stop)

    # 测试内容：成功路径会发送 processing/completed，且完成消息携带 tokenUsage。
    def test_handle_task_payload_success(self) -> None:
        payload = _build_payload()
        runtime = _build_runtime()
        mq = _build_mq()
        result = TaskResult(
            output_text="final text",
            output_parts=[{"type": "text", "text": "final text"}],
            stop_reason="end_turn",
            agent_session_id="session-1",
            token_usage={"input": 10, "output": 20},
        )

        with (
            patch("tasks_server.task.handler.run_task", new=AsyncMock(return_value=result)),
            patch("tasks_server.task.handler.notify_task_processing") as mock_processing,
            patch("tasks_server.task.handler.mark_task_started", return_value=12.3) as mock_started,
            patch("tasks_server.task.handler.mark_task_finished") as mock_finished,
            patch("tasks_server.task.handler.infer_task_info_from_agent_task_type", return_value="正在生成文档摘要...") as mock_info,
        ):
            task_result = handle_task_payload(payload, runtime=runtime, mq=mq)

        mock_started.assert_called_once_with()
        mock_info.assert_called_once_with("kbsummary")
        mock_processing.assert_called_once_with(
            mq,
            task_record_id=101,
            project_id="project-1",
            kb_id="kb-1",
            task_type="agent",
            info="正在生成文档摘要...",
            user_id="7",
            parent_task_record_id=88,
            stage_run_key="agent:summary",
        )
        self.assertEqual(
            task_result.result,
            {
                "outputText": "final text",
                "tokenUsage": {"input": 10, "output": 20},
            },
        )
        self.assertEqual(task_result.user_id, "7")
        mock_finished.assert_called_once_with(12.3, "success")

    # 测试内容：失败路径会抛错并由上游消费者决定是否重试或发送 FAILED 事件。
    def test_handle_task_payload_failure(self) -> None:
        payload = _build_payload()
        runtime = _build_runtime()
        mq = _build_mq()
        error = TaskError(
            TaskErrorDetail(TaskErrorCode.INVALID_PROMPT, "invalid prompt block")
        )

        with (
            patch("tasks_server.task.handler.run_task", new=AsyncMock(side_effect=error)),
            patch("tasks_server.task.handler.notify_task_processing") as mock_processing,
            patch("tasks_server.task.handler.mark_task_started", return_value=45.6) as mock_started,
            patch("tasks_server.task.handler.mark_task_finished") as mock_finished,
            patch("tasks_server.task.handler.infer_task_info_from_agent_task_type", return_value=None),
        ):
            with self.assertRaises(TaskError):
                handle_task_payload(payload, runtime=runtime, mq=mq)

        mock_started.assert_called_once_with()
        mock_processing.assert_called_once_with(
            mq,
            task_record_id=101,
            project_id="project-1",
            kb_id="kb-1",
            task_type="agent",
            info=None,
            user_id="7",
            parent_task_record_id=88,
            stage_run_key="agent:summary",
        )
        mock_finished.assert_called_once_with(45.6, "failed")

    # 测试内容：任务执行超过 worker 配置阈值时，应转换为明确的 timeout 错误码。
    def test_handle_task_payload_timeout(self) -> None:
        payload = _build_payload()
        runtime = RuntimeConfig(
            cwd="/tmp/tasks-server-tests",
            mode="normal",
            auto_approve=True,
            tool_call_mode="error",
            frontend_base_url="",
            task_timeout_seconds=60,
        )
        mq = _build_mq()

        with (
            patch(
                "tasks_server.task.handler.run_task",
                new=AsyncMock(
                    side_effect=TaskError(
                        TaskErrorDetail(
                            TaskErrorCode.TIMEOUT,
                            "task execution timed out after 60 seconds",
                        )
                    )
                ),
            ),
            patch("tasks_server.task.handler.notify_task_processing"),
            patch("tasks_server.task.handler.mark_task_started", return_value=45.6),
            patch("tasks_server.task.handler.mark_task_finished") as mock_finished,
            patch("tasks_server.task.handler.infer_task_info_from_agent_task_type", return_value=None),
            patch("tasks_server.task.handler.logger") as mock_logger,
        ):
            with self.assertRaises(TaskError) as ctx:
                handle_task_payload(payload, runtime=runtime, mq=mq)

        self.assertEqual(ctx.exception.detail.code, TaskErrorCode.TIMEOUT)
        self.assertEqual(
            ctx.exception.detail.message,
            "task execution timed out after 60 seconds",
        )
        mock_logger.info.assert_any_call(
            "task execution start taskRecordId=%s timeoutSeconds=%s asyncRunner=%s",
            101,
            60,
            False,
        )
        mock_finished.assert_called_once_with(45.6, "failed")

    # 测试内容：PROCESSING 发布失败不会阻断业务执行，结果仍由上游完成态通知处理。
    def test_handle_task_payload_processing_notification_failure_does_not_abort(self) -> None:
        payload = _build_payload()
        runtime = _build_runtime()
        mq = _build_mq()
        result = TaskResult(
            output_text="final text",
            output_parts=[{"type": "text", "text": "final text"}],
            stop_reason="end_turn",
            agent_session_id="session-1",
            token_usage=None,
        )

        with (
            patch("tasks_server.task.handler.run_task", new=AsyncMock(return_value=result)),
            patch("tasks_server.task.handler.notify_task_processing", side_effect=RuntimeError("mq down")) as mock_processing,
            patch("tasks_server.task.handler.mark_task_started", return_value=20.5),
            patch("tasks_server.task.handler.mark_task_finished") as mock_finished,
            patch("tasks_server.task.handler.infer_task_info_from_agent_task_type", return_value="正在生成文档摘要..."),
        ):
            task_result = handle_task_payload(payload, runtime=runtime, mq=mq)

        mock_processing.assert_called_once()
        self.assertEqual(task_result.result, {"outputText": "final text"})
        mock_finished.assert_called_once_with(20.5, "success")

    # 测试内容：agentTaskType 命中时 processing 文案按统一 agent 类型推断。
    def test_handle_task_payload_prefers_agent_task_type_info(self) -> None:
        payload = AgentRunCommand(
            messageId="m-1",
            schemaVersion="1.0",
            occurredAt="2026-04-19T00:00:00Z",
            traceId="trace-1",
            producer="backend",
            projectId="project-1",
            kbId="kb-1",
            userId=7,
            taskRecordId=101,
            taskType="agent",
            parentTaskRecordId=88,
            stageRunKey="agent:quiz",
            payload=AgentPayload(
                typeId="t-1",
                agentTaskType="quiz",
                promptVars={},
                docRefs=[{"id": "doc-1", "name": "Alpha"}],
                extraInfo=None,
                agentSessionId="session-1",
                modelConfigType="default",
            ),
            raw={"taskRecordId": 101},
        )
        runtime = _build_runtime()
        mq = _build_mq()
        result = TaskResult(
            output_text="final text",
            output_parts=[{"type": "text", "text": "final text"}],
            stop_reason="end_turn",
            agent_session_id="session-1",
            token_usage=None,
        )

        with (
            patch("tasks_server.task.handler.run_task", new=AsyncMock(return_value=result)),
            patch("tasks_server.task.handler.notify_task_processing") as mock_processing,
            patch("tasks_server.task.handler.mark_task_started", return_value=1.0),
            patch("tasks_server.task.handler.mark_task_finished"),
            patch("tasks_server.task.handler.infer_task_info_from_agent_task_type", return_value="正在生成题目中...") as mock_info,
        ):
            handle_task_payload(payload, runtime=runtime, mq=mq)

        mock_info.assert_called_once_with("quiz")
        self.assertEqual(mock_processing.call_args.kwargs["info"], "正在生成题目中...")

    # 测试内容：kbview agentTaskType 命中时 processing 文案应为关系图生成。
    def test_handle_task_payload_supports_kbview_info(self) -> None:
        payload = AgentRunCommand(
            messageId="m-2",
            schemaVersion="1.0",
            occurredAt="2026-04-19T00:00:00Z",
            traceId="trace-2",
            producer="backend",
            projectId="project-1",
            kbId="kb-1",
            userId=7,
            taskRecordId=102,
            taskType="agent",
            parentTaskRecordId=88,
            stageRunKey="agent:kbview",
            payload=AgentPayload(
                typeId="t-2",
                agentTaskType="kbview",
                promptVars={"focus": "主题关系"},
                docRefs=[{"id": "doc-1", "name": "Alpha"}],
                extraInfo="docs=1;templates=2",
                agentSessionId="session-2",
                modelConfigType="default",
            ),
            raw={"taskRecordId": 102},
        )
        runtime = _build_runtime()
        mq = _build_mq()
        result = TaskResult(
            output_text="关系图已更新",
            output_parts=[{"type": "text", "text": "canvas ready"}],
            stop_reason="end_turn",
            agent_session_id="session-2",
            token_usage=None,
        )

        with (
            patch("tasks_server.task.handler.run_task", new=AsyncMock(return_value=result)),
            patch("tasks_server.task.handler.notify_task_processing") as mock_processing,
            patch("tasks_server.task.handler.mark_task_started", return_value=2.0),
            patch("tasks_server.task.handler.mark_task_finished"),
            patch("tasks_server.task.handler.infer_task_info_from_agent_task_type", return_value="正在生成关系图中...") as mock_info,
        ):
            task_result = handle_task_payload(payload, runtime=runtime, mq=mq)

        mock_info.assert_called_once_with("kbview")
        self.assertEqual(mock_processing.call_args.kwargs["info"], "正在生成关系图中...")

    # 测试内容：card agentTaskType 命中时 processing 文案应为卡片生成。
    def test_handle_task_payload_supports_card_info(self) -> None:
        payload = AgentRunCommand(
            messageId="m-3",
            schemaVersion="1.0",
            occurredAt="2026-04-19T00:00:00Z",
            traceId="trace-3",
            producer="backend",
            projectId="project-1",
            kbId="kb-1",
            userId=7,
            taskRecordId=103,
            taskType="agent",
            parentTaskRecordId=88,
            stageRunKey="agent:card",
            payload=AgentPayload(
                typeId="t-3",
                agentTaskType="card",
                promptVars={"focus": "术语"},
                docRefs=[{"id": "doc-1", "name": "Alpha"}],
                extraInfo=None,
                agentSessionId="session-1",
                modelConfigType="default",
            ),
            raw={"taskRecordId": 103},
        )
        runtime = _build_runtime()
        mq = _build_mq()
        result = TaskResult(
            output_text="final text",
            output_parts=[{"type": "text", "text": "final text"}],
            stop_reason="end_turn",
            agent_session_id="session-1",
            token_usage=None,
        )

        with (
            patch("tasks_server.task.handler.run_task", new=AsyncMock(return_value=result)),
            patch("tasks_server.task.handler.notify_task_processing") as mock_processing,
            patch("tasks_server.task.handler.mark_task_started", return_value=1.0),
            patch("tasks_server.task.handler.mark_task_finished"),
            patch("tasks_server.task.handler.infer_task_info_from_agent_task_type", return_value="正在生成卡片中...") as mock_info,
        ):
            task_result = handle_task_payload(payload, runtime=runtime, mq=mq)

        mock_info.assert_called_once_with("card")
        self.assertEqual(mock_processing.call_args.kwargs["info"], "正在生成卡片中...")
        self.assertEqual(task_result.result["outputText"], "final text")


if __name__ == "__main__":
    unittest.main()
