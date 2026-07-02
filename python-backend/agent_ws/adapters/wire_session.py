# Responsibilities: manage wire-backed root/subagent sessions and stream wire messages to WS clients.

from __future__ import annotations

import asyncio
import os
from datetime import UTC, datetime
from uuid import uuid4
from dataclasses import dataclass, field
from types import SimpleNamespace
from typing import Any, Callable

from kaos.path import KaosPath
from kosong.chat_provider import ChatProviderError
from usage_control import UsageCallDeniedError, UsageControlClient, UsageControlledChatProvider, UsageTurnDeniedError
from usage_control.context import TurnUsageContext
from usage_control.outbox import UsageOutboxEvent, get_usage_delivery_runtime

from agent_ws.adapters.wire_adapter import WireMessageMapper
from agent_ws.adapters.wire_history import register_active_wire, unregister_active_wire
from agent_ws.handlers import logger
from agent_ws.state.manager import AgentStateManager
from agent_ws.utils.agent_dir import normalize_agent_type, resolve_agent_file
from agent_ws.utils.model_config_dir import normalize_model_config_type, resolve_model_config_file
from agent_ws.utils.skills_dir import normalize_skills_type, resolve_skills_dir
from agent_ws.runtime.session_context import resolve_runtime_context
from kimi_cli.app import KimiCLI
from kimi_cli.session import Session
from kimi_cli.soul import LLMNotSet, LLMNotSupported, MaxStepsReached, RunCancelled
from kimi_cli.wire import Wire
from kimi_cli.wire.types import (
    ApprovalRequest,
    HookRequest,
    QuestionRequest,
    SubagentEvent,
    ToolCallRequest,
    TurnBegin,
    TurnEnd,
    WireMessage,
)
from kimi_cli.runtime import reset_current_context, set_current_context
from kosong.message import Message
from kimi_cli.wire.types import TextPart
from kosong.tooling import ToolError, ToolResult, ToolReturnValue
from kimi_cli.subagents.runner import ForegroundRunRequest, ForegroundSubagentRunner
from kimi_cli.store import get_subagent_store
from kimi_cli.store.subagent_store import find_subagent_record


def _timestamp_to_iso(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.astimezone(UTC).isoformat().replace("+00:00", "Z")
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, UTC).isoformat().replace("+00:00", "Z")
    return str(value)


@dataclass
class _WireSessionState:
    session_id: str
    cli: KimiCLI
    mapper: WireMessageMapper
    runtime_state_unsubscribe: Callable[[], None] | None = None
    skills_type: str | None = None
    agent_type: str | None = None
    model_config_type: str | None = None
    cancel_event: asyncio.Event | None = None
    running_task: asyncio.Task[None] | None = None
    pending_approvals: dict[str, ApprovalRequest] = field(default_factory=dict)
    pending_approval_timeouts: dict[str, asyncio.Task[None]] = field(default_factory=dict)
    pending_questions: dict[str, QuestionRequest] = field(default_factory=dict)
    pending_hooks: dict[str, HookRequest] = field(default_factory=dict)
    pending_tools: dict[str, ToolCallRequest] = field(default_factory=dict)
    last_system_prompt: str | None = None
    last_system_prompt_vars: dict[str, str] | None = None


@dataclass
class _SubagentSessionState:
    parent_session_id: str
    agent_id: str
    mapper: WireMessageMapper
    running_task: asyncio.Task[Any] | None = None
    name: str | None = None
    subagent_type: str | None = None
    created_announced: bool = False
    pending_approvals: dict[str, ApprovalRequest] = field(default_factory=dict)
    pending_approval_timeouts: dict[str, asyncio.Task[None]] = field(default_factory=dict)
    pending_questions: dict[str, QuestionRequest] = field(default_factory=dict)
    pending_hooks: dict[str, HookRequest] = field(default_factory=dict)
    pending_tools: dict[str, ToolCallRequest] = field(default_factory=dict)


class WireSessionAdapter:
    def __init__(self, state_manager: AgentStateManager) -> None:
        self._state_manager = state_manager
        self._sessions: dict[str, _WireSessionState] = {}
        self._subagent_sessions: dict[tuple[str, str], _SubagentSessionState] = {}
        self._sessions_lock = asyncio.Lock()
        self._usage_control_client = UsageControlClient()

    async def new_session(
        self,
        agent_session_id: str | None,
        *,
        cwd: str | None = None,
        mcp_servers: list[Any] | None = None,
        skills_type: str | None = None,
        agent_type: str | None = None,
        model_config_type: str | None = None,
    ) -> str:
        if mcp_servers:
            logger.warning("wire_session: mcp_servers ignored in WS mode")
        cwd_value = cwd or os.getenv("KIMI_AGENT_WS_CWD") or os.getcwd()
        session = await Session.create(KaosPath.unsafe_from_local_path(cwd_value), agent_session_id)
        normalized_skills_type = normalize_skills_type(skills_type)
        normalized_agent_type = normalize_agent_type(agent_type)
        normalized_model_config_type = normalize_model_config_type(model_config_type)
        skills_dir = resolve_skills_dir(normalized_skills_type)
        agent_file = resolve_agent_file(normalized_agent_type)
        config_file = resolve_model_config_file(normalized_model_config_type)
        cli = await KimiCLI.create(
            session,
            config=config_file,
            skills_dir=skills_dir,
            agent_file=agent_file,
        )
        mapper = WireMessageMapper(session.id, self._state_manager)
        async with self._sessions_lock:
            self._sessions[session.id] = _WireSessionState(
                session_id=session.id,
                cli=cli,
                mapper=mapper,
                runtime_state_unsubscribe=None,
                skills_type=normalized_skills_type,
                agent_type=normalized_agent_type,
                model_config_type=normalized_model_config_type,
            )
            self.ensure_runtime_state_bridge(self._sessions[session.id])
        return session.id

    async def prompt(
        self,
        agent_session_id: str,
        prompt: list[Any],
        skills_type: str | None = None,
        agent_type: str | None = None,
        model_config_type: str | None = None,
    ) -> Any:
        session_state = await self._ensure_session(
            agent_session_id,
            skills_type=skills_type,
            agent_type=agent_type,
            model_config_type=model_config_type,
        )
        normalized_skills_type = normalize_skills_type(skills_type)
        normalized_agent_type = normalize_agent_type(agent_type)
        normalized_model_config_type = normalize_model_config_type(model_config_type)
        if session_state.skills_type != normalized_skills_type:
            raise RuntimeError("skills_type_mismatch")
        if session_state.agent_type != normalized_agent_type:
            raise RuntimeError("agent_type_mismatch")
        if session_state.model_config_type != normalized_model_config_type:
            raise RuntimeError("model_config_type_mismatch")
        if session_state.running_task and not session_state.running_task.done():
            raise RuntimeError("session_busy")
        self.ensure_runtime_state_bridge(session_state)
        context_token = set_current_context(
            resolve_runtime_context(
                agent_session_id,
                fallback_user_id=self._state_manager.get_user_id_for_session(agent_session_id),
            )
        )
        session_state.cancel_event = asyncio.Event()
        session_state.running_task = asyncio.current_task()
        current_task = asyncio.current_task()
        if current_task is not None:
            session_state.cli.runtime.run_handle_registry.register(
                target_id=agent_session_id,
                kind="session",
                mode="running_foreground",
                task=current_task,
                cancel=lambda: session_state.cancel_event.set()
                if session_state.cancel_event is not None
                else None,
            )
        session_state.cli.runtime.run_state_registry.enter(
            target_id=agent_session_id,
            kind="session",
            mode="running_foreground",
            name=session_state.session_id,
        )
        wire_ref: Wire | None = None
        stop_reason = "end_turn"
        usage_turn_context: TurnUsageContext | None = None
        original_chat_provider: Any | None = None
        should_close_turn = False
        try:
            async def _on_wire_created(wire: Wire) -> None:
                nonlocal wire_ref
                wire_ref = wire
                await register_active_wire(session_state.session_id, wire)

            await self._apply_user_system_prompt(session_state)
            prompt_blocks = await self._prepare_prompt(session_state, prompt)
            usage_turn_context = await self._open_usage_turn_context(session_state)
            original_chat_provider = self._apply_usage_control_provider(session_state, usage_turn_context)
            async for msg in session_state.cli.run(
                prompt_blocks,
                session_state.cancel_event,
                on_wire_created=_on_wire_created,
                wire_file=session_state.cli.soul.wire_file,
            ):
                await self._handle_wire_message(session_state, msg)
            should_close_turn = True
        except MaxStepsReached:
            stop_reason = "max_turn_requests"
            should_close_turn = True
        except RunCancelled:
            stop_reason = "cancelled"
        finally:
            if current_task is not None:
                session_state.cli.runtime.run_handle_registry.unregister(
                    agent_session_id,
                    task=current_task,
                )
            session_state.running_task = None
            session_state.cancel_event = None
            session_state.cli.runtime.run_state_registry.leave(agent_session_id)
            if original_chat_provider is not None and session_state.cli.soul.runtime.llm is not None:
                session_state.cli.soul.runtime.llm.chat_provider = original_chat_provider
            await self._finalize_usage_turn_context(usage_turn_context, should_close_turn)
            reset_current_context(context_token)
            if wire_ref is not None:
                await unregister_active_wire(session_state.session_id, wire_ref)
            for approval in session_state.pending_approvals.values():
                if not approval.resolved:
                    approval.resolve("reject")
            for timeout_task in session_state.pending_approval_timeouts.values():
                timeout_task.cancel()
            for question_request in session_state.pending_questions.values():
                if not question_request.resolved:
                    question_request.resolve({})
            for hook_request in session_state.pending_hooks.values():
                if not hook_request.resolved:
                    hook_request.resolve("allow")
            for tool_request in session_state.pending_tools.values():
                if not tool_request.resolved:
                    tool_request.resolve(
                        ToolError(
                            message="Tool request cancelled before response was received.",
                            brief="Tool request cancelled",
                        )
                    )
            session_state.pending_approvals.clear()
            session_state.pending_approval_timeouts.clear()
            session_state.pending_questions.clear()
            session_state.pending_hooks.clear()
            session_state.pending_tools.clear()
        return SimpleNamespace(stop_reason=stop_reason)

    async def cancel(self, agent_session_id: str) -> bool:
        session_state = await self._ensure_session(agent_session_id)
        return await session_state.cli.runtime.run_handle_registry.cancel_and_wait(agent_session_id)

    async def prompt_subagent(
        self,
        parent_session_id: str,
        agent_id: str,
        prompt_text: str,
        *,
        model: str | None = None,
    ) -> Any:
        session_state = await self._ensure_session(parent_session_id)
        subagent_state = await self._ensure_subagent_session(parent_session_id, agent_id)
        if subagent_state.running_task is not None and not subagent_state.running_task.done():
            raise RuntimeError("subagent_busy")
        record = await get_subagent_store(session_state.cli.session).require_instance(agent_id)
        context_token = set_current_context(
            resolve_runtime_context(
                parent_session_id,
                fallback_user_id=self._state_manager.get_user_id_for_session(parent_session_id),
            )
        )
        subagent_state.running_task = asyncio.current_task()
        wire_ref: Wire | None = None
        user_id = self._state_manager.get_user_id_for_session(parent_session_id)
        if user_id:
            await self._state_manager.register_session(user_id, agent_id, name=record.description)
        try:
            self._state_manager.publish(
                {
                    "event": "session:created",
                    "payload": {
                        "agentSessionId": agent_id,
                        "status": "ok",
                        "name": record.description,
                        "sessionType": "subagent",
                        "parentSessionId": parent_session_id,
                        "subagentType": record.subagent_type,
                    },
                    "meta": {
                        "agentSessionId": parent_session_id,
                        "userId": user_id,
                    },
                }
            )
            await self._publish_subagent_state_snapshot(subagent_state)
            await self._state_manager.set_streaming(agent_id, True)
            self._state_manager.publish(
                {
                    "event": "query:state",
                    "payload": {
                        "agentSessionId": agent_id,
                        "isStreaming": True,
                    },
                    "meta": {
                        "agentSessionId": agent_id,
                        "userId": user_id,
                    },
                }
            )
            await self._publish_subagent_state_snapshot(subagent_state)
            async def _on_wire_created(wire: Wire) -> None:
                nonlocal wire_ref
                wire_ref = wire
                await register_active_wire(agent_id, wire)

            result = await ForegroundSubagentRunner(session_state.cli.runtime).run(
                ForegroundRunRequest(
                    description=record.description.strip() or prompt_text[:80].strip() or agent_id,
                    prompt=prompt_text,
                    requested_type=record.subagent_type,
                    model=model,
                    resume=agent_id,
                    on_wire_message=lambda msg: self._handle_subagent_wire_message(subagent_state, msg),
                    on_wire_created=_on_wire_created,
                    mirror_request_messages_to_parent=False,
                )
            )
        except asyncio.CancelledError:
            result = SimpleNamespace(stop_reason="cancelled", is_error=False)
        finally:
            subagent_state.running_task = None
            await self._state_manager.set_streaming(agent_id, False)
            self._state_manager.publish(
                {
                    "event": "query:state",
                    "payload": {
                        "agentSessionId": agent_id,
                        "isStreaming": False,
                    },
                    "meta": {
                        "agentSessionId": agent_id,
                        "userId": user_id,
                    },
                }
            )
            await self._publish_subagent_state_snapshot(subagent_state)
            if wire_ref is not None:
                await unregister_active_wire(agent_id, wire_ref)
            for approval in subagent_state.pending_approvals.values():
                if not approval.resolved:
                    approval.resolve("reject")
            for timeout_task in subagent_state.pending_approval_timeouts.values():
                timeout_task.cancel()
            for question_request in subagent_state.pending_questions.values():
                if not question_request.resolved:
                    question_request.resolve({})
            for hook_request in subagent_state.pending_hooks.values():
                if not hook_request.resolved:
                    hook_request.resolve("allow")
            for tool_request in subagent_state.pending_tools.values():
                if not tool_request.resolved:
                    tool_request.resolve(
                        ToolError(
                            message="Tool request cancelled before response was received.",
                            brief="Tool request cancelled",
                        )
                    )
            subagent_state.pending_approvals.clear()
            subagent_state.pending_approval_timeouts.clear()
            subagent_state.pending_questions.clear()
            subagent_state.pending_hooks.clear()
            subagent_state.pending_tools.clear()
            await self._publish_subagent_state_snapshot(subagent_state)
            reset_current_context(context_token)
        if result.is_error:
            raise RuntimeError(result.message or result.output)
        stop_reason = "completed"
        return SimpleNamespace(stop_reason=stop_reason)

    async def cancel_subagent(
        self,
        parent_session_id: str,
        agent_id: str,
    ) -> bool:
        subagent_state = await self._ensure_subagent_session(parent_session_id, agent_id)
        parent_session_state = await self._ensure_session(parent_session_id)
        return await parent_session_state.cli.runtime.run_handle_registry.cancel_and_wait(agent_id)

    async def delete(self, agent_session_id: str) -> tuple[bool, str | None]:
        async with self._sessions_lock:
            self._sessions.pop(agent_session_id, None)
        cwd_value = os.getenv("KIMI_AGENT_WS_CWD") or os.getcwd()
        session = await Session.find(KaosPath.unsafe_from_local_path(cwd_value), agent_session_id)
        if session is None:
            return False, "session_not_found"
        await session.delete()
        return True, None

    def resolve_approval(
        self,
        agent_session_id: str,
        request_id: str,
        response: str,
        feedback: str = "",
        *,
        subagent_id: str | None = None,
    ) -> bool:
        session_state = self._resolve_pending_session_state(agent_session_id, subagent_id)
        if session_state is None:
            return False
        request = session_state.pending_approvals.pop(request_id, None)
        if request is None:
            return False
        timeout_task = session_state.pending_approval_timeouts.pop(request_id, None)
        if timeout_task is not None:
            timeout_task.cancel()
        request.resolve(response, feedback)
        if isinstance(session_state, _SubagentSessionState):
            self._state_manager.spawn_task(self._publish_subagent_state_snapshot(session_state))
        else:
            self._state_manager.spawn_task(
                self._publish_parent_session_summary(session_state.session_id)
            )
        return True

    def resolve_question(
        self,
        agent_session_id: str,
        request_id: str,
        answers: dict[str, str],
        *,
        subagent_id: str | None = None,
    ) -> bool:
        session_state = self._resolve_pending_session_state(agent_session_id, subagent_id)
        if session_state is None:
            return False
        request = session_state.pending_questions.pop(request_id, None)
        if request is None:
            return False
        request.resolve(answers)
        if isinstance(session_state, _SubagentSessionState):
            self._state_manager.spawn_task(self._publish_subagent_state_snapshot(session_state))
        else:
            self._state_manager.spawn_task(
                self._publish_parent_session_summary(session_state.session_id)
            )
        return True

    def resolve_hook(
        self,
        agent_session_id: str,
        request_id: str,
        action: str,
        reason: str = "",
        *,
        subagent_id: str | None = None,
    ) -> bool:
        session_state = self._resolve_pending_session_state(agent_session_id, subagent_id)
        if session_state is None:
            return False
        request = session_state.pending_hooks.pop(request_id, None)
        if request is None:
            return False
        request.resolve(action, reason)
        if isinstance(session_state, _SubagentSessionState):
            self._state_manager.spawn_task(self._publish_subagent_state_snapshot(session_state))
        return True

    def resolve_tool_result(
        self,
        agent_session_id: str,
        tool_call_id: str,
        return_value: ToolReturnValue,
        *,
        subagent_id: str | None = None,
    ) -> bool:
        session_state = self._resolve_pending_session_state(agent_session_id, subagent_id)
        if session_state is None:
            return False
        request = session_state.pending_tools.pop(tool_call_id, None)
        if request is None:
            return False
        request.resolve(return_value)
        if isinstance(session_state, _SubagentSessionState):
            self._state_manager.spawn_task(self._publish_subagent_state_snapshot(session_state))
        return True

    def _resolve_pending_session_state(
        self,
        agent_session_id: str,
        subagent_id: str | None,
    ) -> _WireSessionState | _SubagentSessionState | None:
        if subagent_id:
            return self._subagent_sessions.get((agent_session_id, subagent_id))
        session_state = self._sessions.get(agent_session_id)
        if session_state is not None:
            return session_state
        for candidate in self._subagent_sessions.values():
            if candidate.agent_id == agent_session_id:
                return candidate
        return None

    async def _ensure_session(
        self,
        agent_session_id: str,
        *,
        skills_type: str | None = None,
        agent_type: str | None = None,
        model_config_type: str | None = None,
    ) -> _WireSessionState:
        async with self._sessions_lock:
            session_state = self._sessions.get(agent_session_id)
        if session_state is not None:
            return session_state
        cwd_value = os.getenv("KIMI_AGENT_WS_CWD") or os.getcwd()
        session = await Session.find(KaosPath.unsafe_from_local_path(cwd_value), agent_session_id)
        if session is None:
            await self.new_session(agent_session_id, skills_type=skills_type, agent_type=agent_type)
            async with self._sessions_lock:
                session_state = self._sessions[agent_session_id]
            return session_state
        normalized_skills_type = normalize_skills_type(skills_type)
        normalized_agent_type = normalize_agent_type(agent_type)
        normalized_model_config_type = normalize_model_config_type(model_config_type)
        skills_dir = resolve_skills_dir(normalized_skills_type)
        agent_file = resolve_agent_file(normalized_agent_type)
        config_file = resolve_model_config_file(normalized_model_config_type)
        cli = await KimiCLI.create(
            session,
            config=config_file,
            skills_dir=skills_dir,
            agent_file=agent_file,
        )
        mapper = WireMessageMapper(session.id, self._state_manager)
        async with self._sessions_lock:
            self._sessions[agent_session_id] = _WireSessionState(
                session_id=agent_session_id,
                cli=cli,
                mapper=mapper,
                runtime_state_unsubscribe=None,
                skills_type=normalized_skills_type,
                agent_type=normalized_agent_type,
                model_config_type=normalized_model_config_type,
            )
            self.ensure_runtime_state_bridge(self._sessions[agent_session_id])
            return self._sessions[agent_session_id]

    async def _ensure_subagent_session(
        self,
        parent_session_id: str,
        agent_id: str,
    ) -> _SubagentSessionState:
        key = (parent_session_id, agent_id)
        async with self._sessions_lock:
            existing = self._subagent_sessions.get(key)
            if existing is not None:
                return existing
            state = _SubagentSessionState(
                parent_session_id=parent_session_id,
                agent_id=agent_id,
                mapper=WireMessageMapper(agent_id, self._state_manager),
            )
            self._subagent_sessions[key] = state
            return state

    async def _handle_wire_message(self, session_state: _WireSessionState, msg: WireMessage) -> None:
        if isinstance(msg, SubagentEvent):
            await self._handle_parent_subagent_wire_message(session_state, msg)
            return
        if isinstance(msg, ApprovalRequest):
            await self._request_approval(session_state, msg)
            return
        if isinstance(msg, QuestionRequest):
            await self._request_question(session_state, msg)
            return
        if isinstance(msg, HookRequest):
            await self._request_hook(session_state, msg)
            return
        if isinstance(msg, ToolCallRequest):
            await self._request_tool_call(session_state, msg)
            return
        event = await session_state.mapper.to_message_event(msg)
        if event is not None:
            self._state_manager.publish(event)

    def ensure_runtime_state_bridge(self, session_state: _WireSessionState) -> None:
        if session_state.runtime_state_unsubscribe is not None:
            return
        session_state.cli.runtime.background_agent_message_bridge = (
            lambda agent_id, subagent_type, msg: self._handle_background_subagent_wire_message(
                session_state.session_id,
                agent_id,
                subagent_type,
                msg,
            )
        )

        def _on_state_change(state: Any) -> None:
            user_id = self._state_manager.get_user_id_for_session(session_state.session_id)
            if state.kind == "subagent" and state.parent_session_id == session_state.session_id:
                if user_id:
                    self._state_manager.spawn_task(
                        self._state_manager.register_session(
                            user_id,
                            state.target_id,
                            name=state.name,
                            session_type="subagent",
                            parent_session_id=state.parent_session_id,
                            subagent_type=state.subagent_type,
                            status="running_background" if state.is_streaming else "idle",
                        )
                    )
                if state.is_streaming:
                    parent_target = self._state_manager.resolve_watch_target(session_state.session_id)
                    child_target = self._state_manager.resolve_watch_target(state.target_id)
                    if (
                        parent_target is not None
                        and child_target is not None
                        and self._state_manager.has_stream_ownership(parent_target)
                    ):
                        # 父会话仍在流式时，子会话沿用父会话的 ownership，确保切页后仍能收到后续事件。
                        self._state_manager.inherit_stream_ownership_now(parent_target, child_target)
                    elif (
                        user_id
                        and parent_target is not None
                        and child_target is not None
                    ):
                        # 父会话已结束但后台子会话仍在运行时，重新保活父 ownership，
                        # 并让子会话继承它，确保发往父会话的请求事件不会落入 inactive。
                        self._state_manager.begin_stream_ownership_now(user_id, parent_target)
                        self._state_manager.inherit_stream_ownership_now(parent_target, child_target)
                        self._state_manager.mark_stream_ownership_pending_release_now(
                            parent_target
                        )
                    self._state_manager.publish(
                        {
                            "event": "session:created",
                            "payload": {
                                "agentSessionId": state.target_id,
                                "status": "ok",
                                "name": state.name,
                                "sessionType": "subagent",
                                "parentSessionId": state.parent_session_id,
                                "subagentType": state.subagent_type,
                            },
                            "meta": {
                                "agentSessionId": session_state.session_id,
                                "userId": user_id,
                            },
                        }
                    )
                self._publish_query_state(
                    state.target_id,
                    user_id,
                    state.is_streaming,
                )
                self._state_manager.spawn_task(
                    self._publish_runtime_subagent_summary(
                        parent_session_id=session_state.session_id,
                        agent_id=state.target_id,
                        name=state.name,
                        subagent_type=state.subagent_type,
                        is_streaming=state.is_streaming,
                    )
                )

        session_state.runtime_state_unsubscribe = session_state.cli.runtime.run_state_registry.add_listener(
            _on_state_change
        )

    async def _handle_background_subagent_wire_message(
        self,
        parent_session_id: str,
        agent_id: str,
        subagent_type: str,
        msg: WireMessage,
    ) -> None:
        parent_session_state = await self._ensure_session(parent_session_id)
        subagent_state = await self._ensure_subagent_session(parent_session_id, agent_id)
        record = await get_subagent_store(parent_session_state.cli.session).get_instance(agent_id)
        if record is not None:
            subagent_state.name = record.description
            subagent_state.subagent_type = record.subagent_type
            user_id = self._state_manager.get_user_id_for_session(parent_session_id)
            if user_id:
                await self._state_manager.register_session(
                    user_id,
                    agent_id,
                    name=record.description,
                    session_type="subagent",
                    parent_session_id=parent_session_id,
                    subagent_type=record.subagent_type,
                    status=getattr(record, "status", "idle"),
                )
        else:
            subagent_state.subagent_type = subagent_state.subagent_type or subagent_type
        await self._handle_subagent_wire_message(subagent_state, msg)

    async def is_runtime_streaming(self, agent_session_id: str) -> bool:
        session_state = self._sessions.get(agent_session_id)
        if session_state is not None:
            return session_state.cli.runtime.run_state_registry.is_streaming(agent_session_id)
        record = await find_subagent_record(agent_session_id)
        if record is not None:
            parent_session_state = await self._ensure_session(record.parent_session_id)
            self.ensure_runtime_state_bridge(parent_session_state)
            return parent_session_state.cli.runtime.run_state_registry.is_streaming(agent_session_id)
        session_state = await self._ensure_session(agent_session_id)
        self.ensure_runtime_state_bridge(session_state)
        return session_state.cli.runtime.run_state_registry.is_streaming(agent_session_id)

    async def _handle_parent_subagent_wire_message(
        self,
        parent_session_state: _WireSessionState,
        msg: SubagentEvent,
    ) -> None:
        subagent_state = await self._ensure_subagent_session(
            parent_session_state.session_id,
            msg.agent_id,
        )
        user_id = self._state_manager.get_user_id_for_session(parent_session_state.session_id)
        record = await get_subagent_store(parent_session_state.cli.session).get_instance(msg.agent_id)
        if record is not None:
            subagent_state.name = record.description
            subagent_state.subagent_type = record.subagent_type
            if user_id:
                await self._state_manager.register_session(
                    user_id,
                    msg.agent_id,
                    name=record.description,
                    session_type="subagent",
                    parent_session_id=parent_session_state.session_id,
                    subagent_type=record.subagent_type,
                    status=getattr(record, "status", "idle"),
                )
        else:
            subagent_state.name = subagent_state.name or msg.subagent_type or msg.agent_id
            subagent_state.subagent_type = subagent_state.subagent_type or msg.subagent_type
        if not subagent_state.created_announced:
            self._publish_subagent_created(
                parent_session_id=parent_session_state.session_id,
                agent_id=msg.agent_id,
                user_id=user_id,
                name=subagent_state.name,
                subagent_type=subagent_state.subagent_type,
            )
            subagent_state.created_announced = True

        if isinstance(msg.event, TurnBegin):
            await self._inherit_subagent_stream_ownership(
                parent_session_id=parent_session_state.session_id,
                agent_id=msg.agent_id,
            )
            await self._state_manager.set_streaming(msg.agent_id, True)
            await self._publish_subagent_state_snapshot(subagent_state)
            self._publish_query_state(msg.agent_id, user_id, True)
        else:
            await self._handle_subagent_wire_message(subagent_state, msg.event)

        if not isinstance(
            msg.event,
            (ApprovalRequest, QuestionRequest, HookRequest, ToolCallRequest),
        ):
            await self._publish_parent_subagent_mirror_event(parent_session_state, msg)

        if isinstance(msg.event, TurnEnd):
            await self._state_manager.set_streaming(msg.agent_id, False)
            await self._publish_subagent_state_snapshot(subagent_state)
            self._publish_query_state(msg.agent_id, user_id, False)

    async def _handle_subagent_wire_message(
        self,
        session_state: _SubagentSessionState,
        msg: WireMessage,
    ) -> None:
        if isinstance(msg, ApprovalRequest):
            await self._request_subagent_approval(session_state, msg)
            return
        if isinstance(msg, QuestionRequest):
            await self._request_subagent_question(session_state, msg)
            return
        if isinstance(msg, HookRequest):
            await self._request_subagent_hook(session_state, msg)
            return
        if isinstance(msg, ToolCallRequest):
            await self._request_subagent_tool_call(session_state, msg)
            return
        event = await session_state.mapper.to_message_event(msg)
        if event is not None:
            self._state_manager.publish(event)

    def _publish_query_state(
        self,
        agent_session_id: str,
        user_id: str | None,
        is_streaming: bool,
    ) -> None:
        self._state_manager.publish(
            {
                "event": "query:state",
                "payload": {
                    "agentSessionId": agent_session_id,
                    "isStreaming": is_streaming,
                },
                "meta": {
                    "agentSessionId": agent_session_id,
                    "userId": user_id,
                },
            }
        )

    async def _inherit_subagent_stream_ownership(
        self,
        *,
        parent_session_id: str,
        agent_id: str,
    ) -> None:
        parent_target = self._state_manager.resolve_watch_target(parent_session_id)
        child_target = self._state_manager.resolve_watch_target(agent_id)
        if parent_target is None or child_target is None:
            return
        await self._state_manager.inherit_stream_ownership(parent_target, child_target)

    def _publish_subagent_created(
        self,
        *,
        parent_session_id: str,
        agent_id: str,
        user_id: str | None,
        name: str | None,
        subagent_type: str | None,
    ) -> None:
        self._state_manager.publish(
            {
                "event": "session:created",
                "payload": {
                    "agentSessionId": agent_id,
                    "status": "ok",
                    "name": name,
                    "sessionType": "subagent",
                    "parentSessionId": parent_session_id,
                    "subagentType": subagent_type,
                },
                "meta": {
                    "agentSessionId": parent_session_id,
                    "userId": user_id,
                },
            }
        )

    async def publish_subagent_state_update(
        self,
        agent_session_id: str,
        *,
        subagent_id: str | None = None,
    ) -> None:
        session_state = self._resolve_pending_session_state(agent_session_id, subagent_id)
        if not isinstance(session_state, _SubagentSessionState):
            return
        await self._publish_subagent_state_snapshot(session_state)

    async def build_subagent_summary_item(
        self,
        *,
        parent_session_id: str,
        agent_id: str,
        title: str,
        subagent_type: str,
        status: str,
        updated_at: str,
    ) -> dict[str, Any]:
        session_state = self._subagent_sessions.get((parent_session_id, agent_id))
        is_streaming = await self._state_manager.is_streaming(agent_id)
        return {
            "agentId": agent_id,
            "parentSessionId": parent_session_id,
            "subagentType": subagent_type,
            "title": title,
            "status": "running_foreground" if is_streaming else status,
            "updatedAt": updated_at,
            "pendingPermissionCount": len(session_state.pending_approvals) if session_state else 0,
            "pendingQuestionCount": len(session_state.pending_questions) if session_state else 0,
        }

    def get_parent_pending_request_counts(self, parent_session_id: str) -> tuple[int, int]:
        main_session_state = self._sessions.get(parent_session_id)
        permission_count = len(main_session_state.pending_approvals) if main_session_state else 0
        question_count = len(main_session_state.pending_questions) if main_session_state else 0
        for (candidate_parent_session_id, _agent_id), session_state in self._subagent_sessions.items():
            if candidate_parent_session_id != parent_session_id:
                continue
            permission_count += len(session_state.pending_approvals)
            question_count += len(session_state.pending_questions)
        return permission_count, question_count

    async def _publish_parent_session_summary(self, parent_session_id: str) -> None:
        permission_count, question_count = self.get_parent_pending_request_counts(parent_session_id)
        is_streaming = await self._state_manager.is_streaming(parent_session_id)
        await self._state_manager.update_session_summary(
            parent_session_id,
            session_type="main",
            status="running_foreground" if is_streaming else "idle",
            is_streaming=is_streaming,
            pending_permission_count=permission_count,
            pending_question_count=question_count,
        )
        await self._state_manager.publish_session_summary(parent_session_id)

    async def _publish_runtime_subagent_summary(
        self,
        *,
        parent_session_id: str,
        agent_id: str,
        name: str | None,
        subagent_type: str | None,
        is_streaming: bool,
    ) -> None:
        session_state = await self._ensure_subagent_session(parent_session_id, agent_id)
        session_state.name = name or session_state.name
        session_state.subagent_type = subagent_type or session_state.subagent_type
        await self._state_manager.update_session_summary(
            agent_id,
            name=session_state.name or agent_id,
            session_type="subagent",
            parent_session_id=parent_session_id,
            subagent_type=session_state.subagent_type or "subagent",
            status="running_background" if is_streaming else "idle",
            is_streaming=is_streaming,
            pending_permission_count=len(session_state.pending_approvals),
            pending_question_count=len(session_state.pending_questions),
        )
        await self._state_manager.publish_session_summary(agent_id)
        await self._publish_parent_session_summary(parent_session_id)

    async def _publish_subagent_state_snapshot(
        self,
        session_state: _SubagentSessionState,
    ) -> None:
        record = await find_subagent_record(session_state.agent_id)
        user_id = self._state_manager.get_user_id_for_session(session_state.parent_session_id)
        is_streaming = await self._state_manager.is_streaming(session_state.agent_id)
        status = "running_foreground" if is_streaming else (record.status if record else "idle")
        title = (
            record.description
            if record and record.description.strip()
            else session_state.name
            or session_state.agent_id
        )
        subagent_type = (
            record.subagent_type
            if record and record.subagent_type.strip()
            else session_state.subagent_type
            or "subagent"
        )
        updated_at = _timestamp_to_iso(record.updated_at) if record else ""
        await self._state_manager.update_session_summary(
            session_state.agent_id,
            name=title,
            updated_at=updated_at,
            session_type="subagent",
            parent_session_id=session_state.parent_session_id,
            subagent_type=subagent_type,
            status=status,
            is_streaming=is_streaming,
            pending_permission_count=len(session_state.pending_approvals),
            pending_question_count=len(session_state.pending_questions),
        )
        await self._state_manager.publish_session_summary(session_state.agent_id)
        await self._publish_parent_session_summary(session_state.parent_session_id)

    def _build_parent_subagent_event(
        self,
        *,
        parent_tool_call_id: str,
        agent_id: str,
        subagent_type: str | None,
        msg: WireMessage,
    ) -> SubagentEvent:
        return SubagentEvent(
            parent_tool_call_id=parent_tool_call_id,
            agent_id=agent_id,
            subagent_type=subagent_type,
            event=msg,
        )

    async def _publish_parent_subagent_mirror_event(
        self,
        parent_session_state: _WireSessionState,
        msg: SubagentEvent,
    ) -> None:
        event = await parent_session_state.mapper.to_message_event(msg)
        if event is not None:
            self._state_manager.publish(event)

    async def _prepare_prompt(self, session_state: _WireSessionState, prompt: list[Any]) -> list[Any]:
        system_texts: list[str] = []
        user_prompt: list[Any] = []
        for block in prompt:
            if isinstance(block, dict) and block.get("type") == "system_text":
                text = block.get("text")
                if isinstance(text, str) and text.strip():
                    system_texts.append(text.strip())
                continue
            user_prompt.append(block)
        if system_texts:
            await session_state.cli.soul.context.append_message(
                Message(
                    role="system",
                    content=[TextPart(text="\n".join(system_texts))],
                )
            )
        return user_prompt

    # 应用user级别的system prompt覆盖
    async def _apply_user_system_prompt(self, session_state: _WireSessionState) -> None:
        user_id = self._state_manager.get_user_id_for_session(session_state.session_id)
        if not user_id:
            session_state.cli.runtime.update_system_prompt_vars(None)
            session_state.cli.soul.refresh_system_prompt_from_runtime()
            session_state.last_system_prompt = None
            session_state.last_system_prompt_vars = None
            return
        variables = await self._state_manager.get_user_system_prompt_vars(user_id)
        changed = session_state.cli.runtime.update_system_prompt_vars(variables)
        system_prompt = session_state.cli.soul.render_runtime_system_prompt()
        logger.debug(
            "wire_session: render runtime system_prompt user=%s session=%s vars_keys=%s changed=%s system_prompt=%s",
            user_id,
            session_state.session_id,
            list(session_state.cli.runtime.system_prompt_vars.keys()),
            changed,
            system_prompt,
        )
        session_state.last_system_prompt_vars = dict(session_state.cli.runtime.system_prompt_vars)
        if system_prompt == session_state.last_system_prompt:
            return
        session_state.cli.soul.refresh_system_prompt_from_runtime()
        session_state.last_system_prompt = system_prompt

    async def _request_approval(self, session_state: _WireSessionState, request: ApprovalRequest) -> None:
        session_state.pending_approvals[request.id] = request
        # 创建自动拒绝的任务，60秒后如果请求还未被处理则自动拒绝
        session_state.pending_approval_timeouts[request.id] = asyncio.create_task(
            self._auto_reject_approval(session_state, request.id)
        )
        await self._publish_parent_session_summary(session_state.session_id)
        self._state_manager.publish(self._build_permission_request_event(session_state, request))
        await request.wait()
        await self._publish_parent_session_summary(session_state.session_id)

    async def _request_subagent_approval(
        self,
        session_state: _SubagentSessionState,
        request: ApprovalRequest,
    ) -> None:
        session_state.pending_approvals[request.id] = request
        session_state.pending_approval_timeouts[request.id] = asyncio.create_task(
            self._auto_reject_approval(session_state, request.id)
        )
        await self._publish_subagent_state_snapshot(session_state)
        self._state_manager.publish(self._build_permission_request_event(session_state, request))
        await request.wait()

    def pending_permission_events(
        self,
        agent_session_id: str,
        *,
        subagent_id: str | None = None,
    ) -> list[dict[str, Any]]:
        session_states = self._resolve_pending_request_session_states(
            agent_session_id,
            subagent_id=subagent_id,
        )
        events: list[dict[str, Any]] = []
        for session_state in session_states:
            for request in session_state.pending_approvals.values():
                if request.resolved:
                    continue
                events.append(self._build_permission_request_event(session_state, request))
        return events

    def pending_question_events(
        self,
        agent_session_id: str,
        *,
        subagent_id: str | None = None,
    ) -> list[dict[str, Any]]:
        session_states = self._resolve_pending_request_session_states(
            agent_session_id,
            subagent_id=subagent_id,
        )
        events: list[dict[str, Any]] = []
        for session_state in session_states:
            events.extend(
                {
                    "event": "question:request",
                    **self._build_question_request_event(session_state, request),
                }
                for request in session_state.pending_questions.values()
                if not request.resolved
            )
        return events

    def pending_hook_events(
        self,
        agent_session_id: str,
        *,
        subagent_id: str | None = None,
    ) -> list[dict[str, Any]]:
        session_states = self._resolve_pending_request_session_states(
            agent_session_id,
            subagent_id=subagent_id,
        )
        events: list[dict[str, Any]] = []
        for session_state in session_states:
            events.extend(
                {
                    "event": "hook:request",
                    **self._build_hook_request_event(session_state, request),
                }
                for request in session_state.pending_hooks.values()
                if not request.resolved
            )
        return events

    def pending_tool_events(
        self,
        agent_session_id: str,
        *,
        subagent_id: str | None = None,
    ) -> list[dict[str, Any]]:
        session_states = self._resolve_pending_request_session_states(
            agent_session_id,
            subagent_id=subagent_id,
        )
        events: list[dict[str, Any]] = []
        for session_state in session_states:
            events.extend(
                {
                    "event": "tool:request",
                    **self._build_tool_request_event(session_state, request),
                }
                for request in session_state.pending_tools.values()
                if not request.resolved
            )
        return events

    def _build_permission_request_event(
        self,
        session_state: _WireSessionState | _SubagentSessionState,
        request: ApprovalRequest,
    ) -> dict[str, Any]:
        agent_session_id = self._resolve_request_event_session_id(session_state)
        user_id = self._state_manager.get_user_id_for_session(agent_session_id)
        meta: dict[str, Any] = {"agentSessionId": agent_session_id, "userId": user_id}
        return {
            "event": "permission:request",
            "payload": self._build_request_payload(
                session_state,
                {
                    "requestId": request.id,
                    "toolCallId": request.tool_call_id,
                    "sender": request.sender,
                    "action": request.action,
                    "description": request.description,
                    "display": [item.model_dump(mode="json") for item in request.display],
                    "options": ["approve", "approve_for_session", "reject"],
                },
            ),
            "meta": meta,
        }

    def _build_question_request_event(
        self,
        session_state: _WireSessionState | _SubagentSessionState,
        request: QuestionRequest,
    ) -> dict[str, Any]:
        agent_session_id = self._resolve_request_event_session_id(session_state)
        user_id = self._state_manager.get_user_id_for_session(agent_session_id)
        return {
            "payload": self._build_request_payload(
                session_state,
                {
                    "requestId": request.id,
                    "toolCallId": request.tool_call_id,
                    "questions": [item.model_dump(mode="json") for item in request.questions],
                },
            ),
            "meta": {"agentSessionId": agent_session_id, "userId": user_id},
        }

    def _build_hook_request_event(
        self,
        session_state: _WireSessionState | _SubagentSessionState,
        request: HookRequest,
    ) -> dict[str, Any]:
        agent_session_id = self._resolve_request_event_session_id(session_state)
        user_id = self._state_manager.get_user_id_for_session(agent_session_id)
        return {
            "payload": self._build_request_payload(
                session_state,
                {
                    "requestId": request.id,
                    "subscriptionId": request.subscription_id,
                    "hookEvent": request.event,
                    "target": request.target,
                    "inputData": request.input_data,
                    "options": ["allow", "block"],
                },
            ),
            "meta": {"agentSessionId": agent_session_id, "userId": user_id},
        }

    def _build_tool_request_event(
        self,
        session_state: _WireSessionState | _SubagentSessionState,
        request: ToolCallRequest,
    ) -> dict[str, Any]:
        agent_session_id = self._resolve_request_event_session_id(session_state)
        user_id = self._state_manager.get_user_id_for_session(agent_session_id)
        return {
            "payload": self._build_request_payload(
                session_state,
                {
                    "toolCallId": request.id,
                    "name": request.name,
                    "arguments": request.arguments,
                },
            ),
            "meta": {"agentSessionId": agent_session_id, "userId": user_id},
        }

    @staticmethod
    def _build_request_payload(
        session_state: _WireSessionState | _SubagentSessionState,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        if isinstance(session_state, _SubagentSessionState):
            return {
                **payload,
                "subagentId": session_state.agent_id,
            }
        return payload

    @staticmethod
    def _resolve_request_event_session_id(
        session_state: _WireSessionState | _SubagentSessionState,
    ) -> str:
        if isinstance(session_state, _SubagentSessionState):
            return session_state.parent_session_id
        return session_state.session_id

    def _resolve_pending_request_session_states(
        self,
        agent_session_id: str,
        *,
        subagent_id: str | None = None,
    ) -> list[_WireSessionState | _SubagentSessionState]:
        if subagent_id:
            session_state = self._subagent_sessions.get((agent_session_id, subagent_id))
            return [session_state] if session_state is not None else []
        session_states: list[_WireSessionState | _SubagentSessionState] = []
        main_session_state = self._sessions.get(agent_session_id)
        if main_session_state is not None:
            session_states.append(main_session_state)
        for (candidate_parent_session_id, _agent_id), session_state in self._subagent_sessions.items():
            if candidate_parent_session_id == agent_session_id:
                session_states.append(session_state)
        return session_states

    async def _auto_reject_approval(
        self,
        session_state: _WireSessionState | _SubagentSessionState,
        request_id: str,
    ) -> None:
        try:
            await asyncio.sleep(60)
        except asyncio.CancelledError:
            return
        if request_id not in session_state.pending_approvals:
            return
        if isinstance(session_state, _WireSessionState):
            self.resolve_approval(session_state.session_id, request_id, "reject")
            return
        self.resolve_approval(
            session_state.parent_session_id,
            request_id,
            "reject",
            subagent_id=session_state.agent_id,
        )

    async def _request_tool_call(
        self, session_state: _WireSessionState, request: ToolCallRequest
    ) -> None:
        session_state.pending_tools[request.id] = request
        user_id = self._state_manager.get_user_id_for_session(session_state.session_id)
        await self._publish_parent_session_summary(session_state.session_id)
        request_event = self._build_tool_request_event(session_state, request)
        self._state_manager.publish({"event": "tool:request", **request_event})
        await request.wait()
        await self._publish_parent_session_summary(session_state.session_id)

    async def _request_subagent_tool_call(
        self, session_state: _SubagentSessionState, request: ToolCallRequest
    ) -> None:
        session_state.pending_tools[request.id] = request
        await self._publish_subagent_state_snapshot(session_state)
        request_event = self._build_tool_request_event(session_state, request)
        self._state_manager.publish({"event": "tool:request", **request_event})
        await request.wait()

    async def _request_question(
        self, session_state: _WireSessionState, request: QuestionRequest
    ) -> None:
        session_state.pending_questions[request.id] = request
        await self._publish_parent_session_summary(session_state.session_id)
        request_event = self._build_question_request_event(session_state, request)
        self._state_manager.publish({"event": "question:request", **request_event})
        await request.wait()
        await self._publish_parent_session_summary(session_state.session_id)

    async def _request_subagent_question(
        self, session_state: _SubagentSessionState, request: QuestionRequest
    ) -> None:
        session_state.pending_questions[request.id] = request
        await self._publish_subagent_state_snapshot(session_state)
        request_event = self._build_question_request_event(session_state, request)
        self._state_manager.publish({"event": "question:request", **request_event})
        await request.wait()

    async def _request_hook(self, session_state: _WireSessionState, request: HookRequest) -> None:
        session_state.pending_hooks[request.id] = request
        await self._publish_parent_session_summary(session_state.session_id)
        request_event = self._build_hook_request_event(session_state, request)
        self._state_manager.publish({"event": "hook:request", **request_event})
        await request.wait()
        await self._publish_parent_session_summary(session_state.session_id)

    async def _request_subagent_hook(
        self, session_state: _SubagentSessionState, request: HookRequest
    ) -> None:
        session_state.pending_hooks[request.id] = request
        await self._publish_subagent_state_snapshot(session_state)
        request_event = self._build_hook_request_event(session_state, request)
        self._state_manager.publish({"event": "hook:request", **request_event})
        await request.wait()

    async def _open_usage_turn_context(self, session_state: _WireSessionState) -> TurnUsageContext | None:
        if session_state.cli.soul.runtime.llm is None:
            return None
        user_id = self._state_manager.get_user_id_for_session(session_state.session_id)
        runtime_context = resolve_runtime_context(session_state.session_id, fallback_user_id=user_id)
        if not user_id or not runtime_context.project_id:
            raise RuntimeError("usage_context_incomplete")
        try:
            user_id_value = int(user_id)
        except ValueError as exc:
            raise RuntimeError("usage_context_incomplete") from exc
        project_id = runtime_context.project_id
        turn_context = TurnUsageContext(
            user_id=user_id_value,
            project_id=project_id,
            metric="ai_chat_tokens",
            service="agent_ws",
            channel="chat",
            session_id=session_state.session_id,
            kb_id=runtime_context.kb_id,
            turn_id=f"turn:{session_state.session_id}:{uuid4().hex}",
        )
        policy = await self._usage_control_client.get_current_policy(
            user_id=user_id_value,
            project_id=project_id,
            metric=turn_context.metric,
        )
        turn_context.policy = policy
        if policy.policy_mode != "MEMBER":
            return turn_context
        opened, lease, current_policy = await self._usage_control_client.open_turn_lease(
            user_id=user_id_value,
            project_id=project_id,
            metric=turn_context.metric,
            turn_id=turn_context.turn_id,
            lease_id=f"lease:{turn_context.turn_id}",
            idempotency_key=f"turn:{turn_context.turn_id}:open",
            lease_ttl_seconds=1800,
            metadata={
                "service": "agent_ws",
                "channel": "chat",
                "sessionId": session_state.session_id,
                "turnId": turn_context.turn_id,
            },
        )
        if not opened and lease.status != "OPEN":
            raise UsageTurnDeniedError("member turn denied")
        turn_context.lease = lease
        turn_context.policy = current_policy
        return turn_context

    def _apply_usage_control_provider(self, session_state: _WireSessionState, turn_context: TurnUsageContext | None) -> Any | None:
        if turn_context is None or session_state.cli.soul.runtime.llm is None:
            return None
        original_chat_provider = session_state.cli.soul.runtime.llm.chat_provider
        session_state.cli.soul.runtime.llm.chat_provider = UsageControlledChatProvider(
            _delegate=original_chat_provider,
            _client=self._usage_control_client,
            _turn_context=turn_context,
        )
        return original_chat_provider

    async def _finalize_usage_turn_context(self, turn_context: TurnUsageContext | None, should_close_turn: bool) -> None:
        if turn_context is None or turn_context.lease is None:
            return
        try:
            if should_close_turn:
                await self._usage_control_client.close_turn_lease(
                    user_id=turn_context.user_id,
                    lease_id=turn_context.lease.lease_id,
                    turn_id=turn_context.turn_id,
                    idempotency_key=f"turn:{turn_context.turn_id}:close",
                )
                return
            await self._usage_control_client.abort_turn_lease(
                user_id=turn_context.user_id,
                lease_id=turn_context.lease.lease_id,
                turn_id=turn_context.turn_id,
                idempotency_key=f"turn:{turn_context.turn_id}:abort",
            )
        except Exception as exc:
            logger.warning(
                "usage.turn finalize failed session=%s turn=%s lease=%s error=%s",
                turn_context.session_id,
                turn_context.turn_id,
                turn_context.lease.lease_id,
                exc,
            )
            event_type = "close_turn_lease" if should_close_turn else "abort_turn_lease"
            idempotency_key = (
                f"turn:{turn_context.turn_id}:close"
                if should_close_turn
                else f"turn:{turn_context.turn_id}:abort"
            )
            await get_usage_delivery_runtime(self._usage_control_client).enqueue_finalize_retry(
                UsageOutboxEvent(
                    event_type=event_type,
                    idempotency_key=idempotency_key,
                    payload={
                        "user_id": turn_context.user_id,
                        "lease_id": turn_context.lease.lease_id,
                        "turn_id": turn_context.turn_id,
                        "idempotency_key": idempotency_key,
                    },
                )
            )

    async def handle_prompt_error(self, exc: Exception) -> dict[str, Any]:
        if isinstance(exc, RuntimeError) and str(exc) == "session_busy":
            return {"code": "session_busy", "message": "session is already running"}
        if isinstance(exc, RuntimeError) and str(exc) == "subagent_busy":
            return {"code": "subagent_busy", "message": "subagent session is already running"}
        if isinstance(exc, RuntimeError) and str(exc) == "skills_type_mismatch":
            return {"code": "skills_type_mismatch", "message": "skills_type mismatch for session"}
        if isinstance(exc, RuntimeError) and str(exc) == "agent_type_mismatch":
            return {"code": "agent_type_mismatch", "message": "agent_type mismatch for session"}
        if isinstance(exc, RuntimeError) and str(exc) == "model_config_type_mismatch":
            return {
                "code": "model_config_type_mismatch",
                "message": "model_config_type mismatch for session",
            }
        if isinstance(exc, ValueError) and "Unknown skills_type" in str(exc):
            return {"code": "invalid_skills_type", "message": str(exc)}
        if isinstance(exc, ValueError) and "Unknown agent_type" in str(exc):
            return {"code": "invalid_agent_type", "message": str(exc)}
        if isinstance(exc, ValueError) and "Unknown model_config_type" in str(exc):
            return {"code": "invalid_model_config_type", "message": str(exc)}
        if isinstance(exc, ValueError) and "Model config file not found" in str(exc):
            return {"code": "model_config_not_found", "message": str(exc)}
        if isinstance(exc, RuntimeError) and str(exc) == "usage_context_incomplete":
            return {"code": "usage_context_incomplete", "message": "usage control requires userId and projectId"}
        if isinstance(exc, LLMNotSet):
            return {"code": "auth_required", "message": "LLM not set"}
        if isinstance(exc, LLMNotSupported):
            return {"code": "llm_not_supported", "message": str(exc)}
        if isinstance(exc, UsageTurnDeniedError):
            return {"code": "usage_turn_denied", "message": str(exc)}
        if isinstance(exc, UsageCallDeniedError):
            return {"code": "usage_call_denied", "message": str(exc)}
        if isinstance(exc, ChatProviderError):
            return {"code": "llm_error", "message": str(exc)}
        return {"code": "internal_error", "message": str(exc)}

    def build_tool_result_from_payload(self, payload: dict[str, Any]) -> ToolReturnValue:
        try:
            tool_result = ToolResult.model_validate(payload)
        except Exception as exc:
            logger.warning("wire_session: invalid tool result payload error=%s", exc)
            return ToolError(
                message="Invalid tool result payload from client.",
                brief="Invalid tool result",
            )
        return tool_result.return_value
