# 该文件职责：验证 tasks_server search 结果中的知识库引用会被改写为前端详情链接。

from __future__ import annotations

import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

try:
    from tasks_server.config import RuntimeConfig
    from tasks_server.mq.generated_contracts import AgentPayload, AgentRunCommand, TaskDocRef
except ModuleNotFoundError as exc:
    if exc.name == "pydantic":
        RuntimeConfig = None  # type: ignore[assignment]
        AgentPayload = None  # type: ignore[assignment]
        AgentRunCommand = None  # type: ignore[assignment]
        TaskDocRef = None  # type: ignore[assignment]
    else:
        raise
try:
    from tasks_server.runtime.executor import _rewrite_search_citations
    from tasks_server.runtime.executor import _USAGE_CONTROL_CLIENT
    from tasks_server.runtime.executor import _open_usage_turn_context
    from tasks_server.runtime.executor import _TASK_CANCEL_GRACE_SECONDS
    from tasks_server.runtime.executor import run_task
except ModuleNotFoundError as exc:
    if exc.name in {"kosong", "kimi_cli", "pydantic", "usage_control"}:
        _rewrite_search_citations = None  # type: ignore[assignment]
        _USAGE_CONTROL_CLIENT = None  # type: ignore[assignment]
        _open_usage_turn_context = None  # type: ignore[assignment]
        _TASK_CANCEL_GRACE_SECONDS = None  # type: ignore[assignment]
        run_task = None  # type: ignore[assignment]
    else:
        raise
try:
    from tasks_server.task.errors import TaskTimeoutError
except ModuleNotFoundError as exc:
    if exc.name in {"kosong", "prometheus_client"}:
        TaskTimeoutError = None  # type: ignore[assignment]
    else:
        raise


@unittest.skipIf(
    _rewrite_search_citations is None or RuntimeConfig is None,
    "tasks_server runtime deps not installed",
)
class SearchCitationRewriteTests(unittest.TestCase):
    def test_rewrite_search_citations_uses_doc_ref_name_and_frontend_url(self) -> None:
        payload = AgentRunCommand(
            projectId="project-1",
            kbId="kb-1",
            payload=AgentPayload(
                agentTaskType="search",
                docRefs=[
                    TaskDocRef(id="doc-1", name="产品说明书"),
                ],
            ),
        )
        runtime = RuntimeConfig(
            cwd="/tmp/tasks-server-tests",
            mode="normal",
            auto_approve=True,
            tool_call_mode="error",
            frontend_base_url="https://frontend.example.com",
        )

        rewritten = _rewrite_search_citations(
            "结论来自这里([doc-1][12-15])。",
            payload,
            runtime,
        )

        self.assertEqual(
            rewritten,
            "结论来自这里[产品说明书 第12-15页](https://frontend.example.com/resource-center/project-1/kb-1/fullscreen/kbdoc/doc-1?page=12)。",
        )

    def test_rewrite_search_citations_falls_back_to_default_document_label(self) -> None:
        payload = AgentRunCommand(
            projectId="project-1",
            kbId="kb-1",
            payload=AgentPayload(
                agentTaskType="search",
                docRefs=[],
            ),
        )
        runtime = RuntimeConfig(
            cwd="/tmp/tasks-server-tests",
            mode="normal",
            auto_approve=True,
            tool_call_mode="error",
            frontend_base_url="",
        )

        rewritten = _rewrite_search_citations(
            "见参考([doc-x][8])",
            payload,
            runtime,
        )

        self.assertEqual(
            rewritten,
            "见参考[文档 第8页](/resource-center/project-1/kb-1/fullscreen/kbdoc/doc-x?page=8)",
        )

    def test_rewrite_search_citations_skips_non_search_tasks(self) -> None:
        payload = AgentRunCommand(
            projectId="project-1",
            kbId="kb-1",
            payload=AgentPayload(
                agentTaskType="kbsummary",
                docRefs=[TaskDocRef(id="doc-1", name="产品说明书")],
            ),
        )
        runtime = RuntimeConfig(
            cwd="/tmp/tasks-server-tests",
            mode="normal",
            auto_approve=True,
            tool_call_mode="error",
            frontend_base_url="https://frontend.example.com",
        )

        original = "结论来自这里([doc-1][12])。"
        self.assertEqual(_rewrite_search_citations(original, payload, runtime), original)


@unittest.skipIf(
    run_task is None or RuntimeConfig is None or AgentPayload is None or AgentRunCommand is None,
    "tasks_server runtime deps not installed",
)
class RuntimeModeTests(unittest.IsolatedAsyncioTestCase):
    async def test_run_task_error_mode_forces_failure_before_runtime_setup(self) -> None:
        payload = AgentRunCommand(
            projectId="project-1",
            kbId="kb-1",
            taskRecordId=1,
            taskType="agent",
            stageRunKey="agent:summary",
            payload=AgentPayload(agentTaskType="kbsummary", docRefs=[]),
        )
        runtime = RuntimeConfig(
            cwd="/tmp/tasks-server-tests",
            mode="error",
            auto_approve=True,
            tool_call_mode="error",
            frontend_base_url="",
        )

        with self.assertRaisesRegex(RuntimeError, "forced error mode"):
            await run_task(payload, runtime)

    async def test_run_task_timeout_requests_agent_cancel_before_failing(self) -> None:
        payload = AgentRunCommand(
            projectId="project-1",
            kbId="kb-1",
            taskRecordId=1,
            taskType="agent",
            stageRunKey="agent:summary",
            payload=AgentPayload(
                agentTaskType="kbsummary",
                docRefs=[],
                agentSessionId="session-1",
                modelConfigType="default",
            ),
        )
        runtime = RuntimeConfig(
            cwd="/tmp/tasks-server-tests",
            mode="normal",
            auto_approve=True,
            tool_call_mode="error",
            frontend_base_url="",
            task_timeout_seconds=1,
        )

        cancel_seen = asyncio.Event()

        async def _fake_stream(*, cancel_event: asyncio.Event, **_: object):
            while not cancel_event.is_set():
                await asyncio.sleep(0.01)
            cancel_seen.set()
            raise RuntimeError("cancelled-after-timeout")
            yield  # pragma: no cover

        cli = SimpleNamespace(
            session=SimpleNamespace(id="session-1"),
            soul=SimpleNamespace(
                runtime=SimpleNamespace(llm=None, update_system_prompt_vars=lambda *_: None),
                wire_file="wire.jsonl",
                refresh_system_prompt_from_runtime=lambda: None,
            ),
            run_flow=_fake_stream,
        )

        with (
            patch("tasks_server.runtime.executor.get_or_create_session", new=AsyncMock(return_value=SimpleNamespace(id="session-1"))),
            patch("tasks_server.runtime.executor._resolve_task_runtime", new=AsyncMock(return_value=(SimpleNamespace(skills_type="x", agent_type="y", flow_name="flow"), {}, []))),
            patch("tasks_server.runtime.executor.normalize_model_config_type", return_value="default"),
            patch("tasks_server.runtime.executor.resolve_skills_dir", return_value="/tmp/skills"),
            patch("tasks_server.runtime.executor.resolve_agent_file", return_value="/tmp/agent.yaml"),
            patch("tasks_server.runtime.executor.resolve_model_config_file", return_value="/tmp/model.toml"),
            patch("tasks_server.runtime.executor.KimiCLI.create", new=AsyncMock(return_value=cli)),
            patch("tasks_server.runtime.executor._open_usage_turn_context", new=AsyncMock(return_value=None)),
            patch("tasks_server.runtime.executor.logger") as mock_logger,
        ):
            with self.assertRaises(TaskTimeoutError):
                await run_task(payload, runtime)

        self.assertTrue(cancel_seen.is_set())
        mock_logger.warning.assert_called_once_with(
            "task execution timeout reached taskRecordId=%s timeoutSeconds=%s action=cancel_agent",
            1,
            1,
        )

    async def test_run_task_timeout_waits_for_forced_cancellation_cleanup(self) -> None:
        payload = AgentRunCommand(
            projectId="project-1",
            kbId="kb-1",
            taskRecordId=3,
            taskType="agent",
            stageRunKey="agent:summary",
            payload=AgentPayload(
                agentTaskType="kbsummary",
                docRefs=[],
                agentSessionId="session-1",
                modelConfigType="default",
            ),
        )
        runtime = RuntimeConfig(
            cwd="/tmp/tasks-server-tests",
            mode="normal",
            auto_approve=True,
            tool_call_mode="error",
            frontend_base_url="",
            task_timeout_seconds=0.01,
        )

        cleanup_done = asyncio.Event()

        async def _fake_stream(**_: object):
            try:
                while True:
                    await asyncio.sleep(0.01)
            except asyncio.CancelledError:
                await asyncio.sleep(0)
                cleanup_done.set()
                raise
            yield  # pragma: no cover

        cli = SimpleNamespace(
            session=SimpleNamespace(id="session-1"),
            soul=SimpleNamespace(
                runtime=SimpleNamespace(llm=None, update_system_prompt_vars=lambda *_: None),
                wire_file="wire.jsonl",
                refresh_system_prompt_from_runtime=lambda: None,
            ),
            run_flow=_fake_stream,
        )

        with (
            patch("tasks_server.runtime.executor.get_or_create_session", new=AsyncMock(return_value=SimpleNamespace(id="session-1"))),
            patch("tasks_server.runtime.executor._resolve_task_runtime", new=AsyncMock(return_value=(SimpleNamespace(skills_type="x", agent_type="y", flow_name="flow"), {}, []))),
            patch("tasks_server.runtime.executor.normalize_model_config_type", return_value="default"),
            patch("tasks_server.runtime.executor.resolve_skills_dir", return_value="/tmp/skills"),
            patch("tasks_server.runtime.executor.resolve_agent_file", return_value="/tmp/agent.yaml"),
            patch("tasks_server.runtime.executor.resolve_model_config_file", return_value="/tmp/model.toml"),
            patch("tasks_server.runtime.executor.KimiCLI.create", new=AsyncMock(return_value=cli)),
            patch("tasks_server.runtime.executor._open_usage_turn_context", new=AsyncMock(return_value=None)),
            patch("tasks_server.runtime.executor._TASK_CANCEL_GRACE_SECONDS", 0.01),
        ):
            with self.assertRaises(TaskTimeoutError):
                await run_task(payload, runtime)

        self.assertTrue(cleanup_done.is_set())

    async def test_run_task_returns_success_when_timeout_races_with_completed_stream(self) -> None:
        payload = AgentRunCommand(
            projectId="project-1",
            kbId="kb-1",
            taskRecordId=7,
            taskType="agent",
            stageRunKey="agent:summary",
            payload=AgentPayload(
                agentTaskType="kbsummary",
                docRefs=[],
                agentSessionId="session-1",
                modelConfigType="default",
            ),
        )
        runtime = RuntimeConfig(
            cwd="/tmp/tasks-server-tests",
            mode="normal",
            auto_approve=True,
            tool_call_mode="error",
            frontend_base_url="",
            task_timeout_seconds=0.01,
        )

        async def _fake_stream(**_: object):
            yield SimpleNamespace(
                __class__=SimpleNamespace(__name__="ContentPart"),
            )

        class FakeContentPart:
            def __init__(self, text: str) -> None:
                self.text = text

        async def _completed_stream(**_: object):
            yield FakeContentPart("done")

        class _FakeTimeout:
            async def __aenter__(self) -> "_FakeTimeout":
                return self

            async def __aexit__(self, exc_type, exc, tb) -> bool:
                raise TimeoutError("timeout raced after completion")

        cli = SimpleNamespace(
            session=SimpleNamespace(id="session-1"),
            soul=SimpleNamespace(
                runtime=SimpleNamespace(llm=None, update_system_prompt_vars=lambda *_: None),
                wire_file="wire.jsonl",
                refresh_system_prompt_from_runtime=lambda: None,
            ),
            run_flow=_completed_stream,
        )

        with (
            patch("tasks_server.runtime.executor.get_or_create_session", new=AsyncMock(return_value=SimpleNamespace(id="session-1"))),
            patch("tasks_server.runtime.executor._resolve_task_runtime", new=AsyncMock(return_value=(SimpleNamespace(skills_type="x", agent_type="y", flow_name="flow"), {}, []))),
            patch("tasks_server.runtime.executor.normalize_model_config_type", return_value="default"),
            patch("tasks_server.runtime.executor.resolve_skills_dir", return_value="/tmp/skills"),
            patch("tasks_server.runtime.executor.resolve_agent_file", return_value="/tmp/agent.yaml"),
            patch("tasks_server.runtime.executor.resolve_model_config_file", return_value="/tmp/model.toml"),
            patch("tasks_server.runtime.executor.KimiCLI.create", new=AsyncMock(return_value=cli)),
            patch("tasks_server.runtime.executor._open_usage_turn_context", new=AsyncMock(return_value=None)),
            patch("tasks_server.runtime.executor._serialize_parts", return_value=[{"type": "text", "text": "done"}]),
            patch("tasks_server.runtime.executor._collect_text", return_value="done"),
            patch("tasks_server.runtime.executor._rewrite_search_output_parts", return_value=[{"type": "text", "text": "done"}]),
            patch("tasks_server.runtime.executor.asyncio.timeout", return_value=_FakeTimeout()),
            patch("tasks_server.runtime.executor.ContentPart", FakeContentPart),
            patch("tasks_server.runtime.executor.logger") as mock_logger,
        ):
            result = await run_task(payload, runtime)

        self.assertEqual(result.output_text, "done")
        self.assertEqual(result.output_parts, [{"type": "text", "text": "done"}])
        self.assertEqual(result.stop_reason, "end_turn")
        mock_logger.warning.assert_not_called()

    async def test_run_task_timeout_bounds_forced_cancellation_wait(self) -> None:
        payload = AgentRunCommand(
            projectId="project-1",
            kbId="kb-1",
            taskRecordId=5,
            taskType="agent",
            stageRunKey="agent:summary",
            payload=AgentPayload(
                agentTaskType="kbsummary",
                docRefs=[],
                agentSessionId="session-1",
                modelConfigType="default",
            ),
        )
        runtime = RuntimeConfig(
            cwd="/tmp/tasks-server-tests",
            mode="normal",
            auto_approve=True,
            tool_call_mode="error",
            frontend_base_url="",
            task_timeout_seconds=0.01,
        )

        first_cancel_seen = asyncio.Event()
        async def _fake_stream(*, cancel_event: asyncio.Event, **_: object):
            try:
                while True:
                    await asyncio.sleep(1)
            except asyncio.CancelledError:
                first_cancel_seen.set()
                await asyncio.sleep(1)
            yield  # pragma: no cover

        cli = SimpleNamespace(
            session=SimpleNamespace(id="session-1"),
            soul=SimpleNamespace(
                runtime=SimpleNamespace(llm=None, update_system_prompt_vars=lambda *_: None),
                wire_file="wire.jsonl",
                refresh_system_prompt_from_runtime=lambda: None,
            ),
            run_flow=_fake_stream,
        )

        with (
            patch("tasks_server.runtime.executor.get_or_create_session", new=AsyncMock(return_value=SimpleNamespace(id="session-1"))),
            patch("tasks_server.runtime.executor._resolve_task_runtime", new=AsyncMock(return_value=(SimpleNamespace(skills_type="x", agent_type="y", flow_name="flow"), {}, []))),
            patch("tasks_server.runtime.executor.normalize_model_config_type", return_value="default"),
            patch("tasks_server.runtime.executor.resolve_skills_dir", return_value="/tmp/skills"),
            patch("tasks_server.runtime.executor.resolve_agent_file", return_value="/tmp/agent.yaml"),
            patch("tasks_server.runtime.executor.resolve_model_config_file", return_value="/tmp/model.toml"),
            patch("tasks_server.runtime.executor.KimiCLI.create", new=AsyncMock(return_value=cli)),
            patch("tasks_server.runtime.executor._open_usage_turn_context", new=AsyncMock(return_value=None)),
            patch("tasks_server.runtime.executor._TASK_CANCEL_GRACE_SECONDS", 0.01),
        ):
            with self.assertRaises(TaskTimeoutError):
                await asyncio.wait_for(run_task(payload, runtime), timeout=0.2)

        self.assertTrue(first_cancel_seen.is_set())

    async def test_run_task_timeout_covers_setup_work_before_stream_start(self) -> None:
        payload = AgentRunCommand(
            projectId="project-1",
            kbId="kb-1",
            taskRecordId=6,
            taskType="agent",
            stageRunKey="agent:summary",
            payload=AgentPayload(
                agentTaskType="kbsummary",
                docRefs=[],
                agentSessionId="session-1",
                modelConfigType="default",
            ),
        )
        runtime = RuntimeConfig(
            cwd="/tmp/tasks-server-tests",
            mode="normal",
            auto_approve=True,
            tool_call_mode="error",
            frontend_base_url="",
            task_timeout_seconds=0.01,
        )

        async def _slow_get_or_create_session(*_: object, **__: object):
            await asyncio.sleep(0.05)
            return SimpleNamespace(id="session-1")

        with patch("tasks_server.runtime.executor.get_or_create_session", new=_slow_get_or_create_session):
            with self.assertRaises(TaskTimeoutError):
                await run_task(payload, runtime)

    async def test_run_task_preserves_inner_timeout_error(self) -> None:
        payload = AgentRunCommand(
            projectId="project-1",
            kbId="kb-1",
            taskRecordId=2,
            taskType="agent",
            stageRunKey="agent:summary",
            payload=AgentPayload(
                agentTaskType="kbsummary",
                docRefs=[],
                agentSessionId="session-1",
                modelConfigType="default",
            ),
        )
        runtime = RuntimeConfig(
            cwd="/tmp/tasks-server-tests",
            mode="normal",
            auto_approve=True,
            tool_call_mode="error",
            frontend_base_url="",
            task_timeout_seconds=10,
        )

        async def _fake_stream(**_: object):
            raise TimeoutError("upstream request timeout")
            yield  # pragma: no cover

        cli = SimpleNamespace(
            session=SimpleNamespace(id="session-1"),
            soul=SimpleNamespace(
                runtime=SimpleNamespace(llm=None, update_system_prompt_vars=lambda *_: None),
                wire_file="wire.jsonl",
                refresh_system_prompt_from_runtime=lambda: None,
            ),
            run_flow=_fake_stream,
        )

        with (
            patch("tasks_server.runtime.executor.get_or_create_session", new=AsyncMock(return_value=SimpleNamespace(id="session-1"))),
            patch("tasks_server.runtime.executor._resolve_task_runtime", new=AsyncMock(return_value=(SimpleNamespace(skills_type="x", agent_type="y", flow_name="flow"), {}, []))),
            patch("tasks_server.runtime.executor.normalize_model_config_type", return_value="default"),
            patch("tasks_server.runtime.executor.resolve_skills_dir", return_value="/tmp/skills"),
            patch("tasks_server.runtime.executor.resolve_agent_file", return_value="/tmp/agent.yaml"),
            patch("tasks_server.runtime.executor.resolve_model_config_file", return_value="/tmp/model.toml"),
            patch("tasks_server.runtime.executor.KimiCLI.create", new=AsyncMock(return_value=cli)),
            patch("tasks_server.runtime.executor._open_usage_turn_context", new=AsyncMock(return_value=None)),
            patch("tasks_server.runtime.executor.logger") as mock_logger,
        ):
            with self.assertRaisesRegex(TimeoutError, "upstream request timeout"):
                await run_task(payload, runtime)

        mock_logger.warning.assert_not_called()


@unittest.skipIf(_open_usage_turn_context is None, "tasks_server runtime deps not installed")
class UsageControlTests(unittest.IsolatedAsyncioTestCase):
    async def test_open_usage_turn_context_allows_missing_project_id(self) -> None:
        payload = AgentRunCommand(
            projectId=None,
            kbId="kb-1",
            userId=7,
            taskRecordId=12,
            payload=AgentPayload(
                agentTaskType="kbsummary",
                agentSessionId="session-1",
                docRefs=[],
            ),
        )
        cli = SimpleNamespace(
            soul=SimpleNamespace(runtime=SimpleNamespace(llm=object())),
            session=SimpleNamespace(id="session-1"),
        )
        calls: list[dict[str, object]] = []

        async def fake_get_current_policy(**kwargs):
            calls.append(kwargs)
            return SimpleNamespace(policy_mode="NON_MEMBER")

        original = _USAGE_CONTROL_CLIENT.get_current_policy
        _USAGE_CONTROL_CLIENT.get_current_policy = fake_get_current_policy
        try:
            turn_context = await _open_usage_turn_context(payload, cli)
        finally:
            _USAGE_CONTROL_CLIENT.get_current_policy = original

        self.assertIsNotNone(turn_context)
        self.assertEqual(turn_context.project_id, "")
        self.assertEqual(
            calls,
            [
                {
                    "user_id": 7,
                    "project_id": "",
                    "metric": "ai_chat_tokens",
                },
            ],
        )


@unittest.skipIf(
    run_task is None or RuntimeConfig is None or AgentPayload is None or AgentRunCommand is None,
    "tasks_server runtime deps not installed",
)
class TimeoutLeaseFinalizeTests(unittest.IsolatedAsyncioTestCase):
    async def test_run_task_timeout_aborts_usage_lease_after_cooperative_cancel(self) -> None:
        payload = AgentRunCommand(
            projectId="project-1",
            kbId="kb-1",
            userId=7,
            taskRecordId=4,
            taskType="agent",
            stageRunKey="agent:summary",
            payload=AgentPayload(
                agentTaskType="kbsummary",
                docRefs=[],
                agentSessionId="session-1",
                modelConfigType="default",
            ),
        )
        runtime = RuntimeConfig(
            cwd="/tmp/tasks-server-tests",
            mode="normal",
            auto_approve=True,
            tool_call_mode="error",
            frontend_base_url="",
            task_timeout_seconds=0.01,
        )

        turn_context = SimpleNamespace(
            user_id=7,
            session_id="session-1",
            turn_id="turn-1",
            lease=SimpleNamespace(lease_id="lease-1"),
        )

        async def _fake_stream(*, cancel_event: asyncio.Event, **_: object):
            while not cancel_event.is_set():
                await asyncio.sleep(0.01)
            return
            yield  # pragma: no cover

        cli = SimpleNamespace(
            session=SimpleNamespace(id="session-1"),
            soul=SimpleNamespace(
                runtime=SimpleNamespace(llm=None, update_system_prompt_vars=lambda *_: None),
                wire_file="wire.jsonl",
                refresh_system_prompt_from_runtime=lambda: None,
            ),
            run_flow=_fake_stream,
        )

        with (
            patch("tasks_server.runtime.executor.get_or_create_session", new=AsyncMock(return_value=SimpleNamespace(id="session-1"))),
            patch("tasks_server.runtime.executor._resolve_task_runtime", new=AsyncMock(return_value=(SimpleNamespace(skills_type="x", agent_type="y", flow_name="flow"), {}, []))),
            patch("tasks_server.runtime.executor.normalize_model_config_type", return_value="default"),
            patch("tasks_server.runtime.executor.resolve_skills_dir", return_value="/tmp/skills"),
            patch("tasks_server.runtime.executor.resolve_agent_file", return_value="/tmp/agent.yaml"),
            patch("tasks_server.runtime.executor.resolve_model_config_file", return_value="/tmp/model.toml"),
            patch("tasks_server.runtime.executor.KimiCLI.create", new=AsyncMock(return_value=cli)),
            patch("tasks_server.runtime.executor._open_usage_turn_context", new=AsyncMock(return_value=turn_context)),
            patch("tasks_server.runtime.executor._finalize_usage_turn_context", new=AsyncMock()) as mock_finalize,
        ):
            with self.assertRaises(TaskTimeoutError):
                await run_task(payload, runtime)

        mock_finalize.assert_awaited_once_with(turn_context, should_close_turn=False)
