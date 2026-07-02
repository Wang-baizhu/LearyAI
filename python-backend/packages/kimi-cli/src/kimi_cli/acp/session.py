# 该文件职责：ACP 会话的运行与 wire 消息转发。
from __future__ import annotations

import asyncio
import json
import uuid
from contextvars import ContextVar
from typing import Any

import acp
import streamingjson  # type: ignore[reportMissingTypeStubs]
from kaos import Kaos, reset_current_kaos, set_current_kaos
from kosong.chat_provider import ChatProviderError

from kimi_cli.acp.convert import (
    acp_blocks_to_content_parts,
    display_block_to_acp_content,
    tool_result_to_acp_content,
)
from kimi_cli.acp.types import ACPContentBlock
from kimi_cli.app import KimiCLI
from kimi_cli.soul import LLMNotSet, LLMNotSupported, MaxStepsReached, RunCancelled
from kimi_cli.tools import extract_key_argument
from kimi_cli.utils.logging import logger
from kosong.message import Message
from kimi_cli.wire.types import (
    ApprovalRequest,
    ApprovalResponse,
    BtwBegin,
    BtwEnd,
    CompactionBegin,
    CompactionEnd,
    ContentPart,
    HookRequest,
    HookResolved,
    HookTriggered,
    MCPLoadingBegin,
    MCPLoadingEnd,
    Notification,
    PlanDisplay,
    QuestionRequest,
    StatusUpdate,
    SteerInput,
    StepBegin,
    StepInterrupted,
    SubagentEvent,
    TextPart,
    ThinkPart,
    TodoDisplayBlock,
    ToolCall,
    ToolCallPart,
    ToolCallRequest,
    ToolResult,
    TurnBegin,
    TurnEnd,
)

_current_turn_id = ContextVar[str | None]("current_turn_id", default=None)
_terminal_tool_call_ids = ContextVar[set[str] | None]("terminal_tool_call_ids", default=None)


def get_current_acp_tool_call_id_or_none() -> str | None:
    """See `_ToolCallState.acp_tool_call_id`."""
    from kimi_cli.soul.toolset import get_current_tool_call_or_none

    turn_id = _current_turn_id.get()
    if turn_id is None:
        return None
    tool_call = get_current_tool_call_or_none()
    if tool_call is None:
        return None
    return f"{turn_id}/{tool_call.id}"


def register_terminal_tool_call_id(tool_call_id: str) -> None:
    calls = _terminal_tool_call_ids.get()
    if calls is not None:
        calls.add(tool_call_id)


def should_hide_terminal_output(tool_call_id: str) -> bool:
    calls = _terminal_tool_call_ids.get()
    return calls is not None and tool_call_id in calls


class _ToolCallState:
    """Manages the state of a single tool call for streaming updates."""

    def __init__(self, tool_call: ToolCall):
        self.tool_call = tool_call
        self.args = tool_call.function.arguments or ""
        self.lexer = streamingjson.Lexer()
        if tool_call.function.arguments is not None:
            self.lexer.append_string(tool_call.function.arguments)

    @property
    def acp_tool_call_id(self) -> str:
        # When the user rejected or cancelled a tool call, the step result may not
        # be appended to the context. In this case, future step may emit tool call
        # with the same tool call ID (on the LLM side). To avoid confusion of the
        # ACP client, we ensure the uniqueness by prefixing with the turn ID.
        turn_id = _current_turn_id.get()
        assert turn_id is not None
        return f"{turn_id}/{self.tool_call.id}"

    def append_args_part(self, args_part: str) -> None:
        """Append a new arguments part to the accumulated args and lexer."""
        self.args += args_part
        self.lexer.append_string(args_part)

    def get_title(self) -> str:
        """Get the current title with subtitle if available."""
        tool_name = self.tool_call.function.name
        subtitle = extract_key_argument(self.lexer, tool_name)
        if subtitle:
            return f"{tool_name}: {subtitle}"
        return tool_name


class _TurnState:
    def __init__(self):
        self.id = str(uuid.uuid4())
        """Unique ID for the turn."""
        self.tool_calls: dict[str, _ToolCallState] = {}
        """Map of tool call ID (LLM-side ID) to tool call state."""
        self.last_tool_call: _ToolCallState | None = None
        self.cancel_event = asyncio.Event()


class ACPSession:
    def __init__(
        self,
        id: str,
        cli: KimiCLI,
        acp_conn: acp.Client,
        kaos: Kaos | None = None,
    ) -> None:
        self._id = id
        self._cli = cli
        self._conn = acp_conn
        self._kaos = kaos
        self._turn_state: _TurnState | None = None
        self._subagent_names: dict[str, str] = {}
        self._subagent_started: set[str] = set()
        self._subagent_tool_calls: dict[str, _ToolCallState] = {}

    @property
    def id(self) -> str:
        """The ID of the ACP session."""
        return self._id

    @property
    def cli(self) -> KimiCLI:
        """The Kimi CLI instance bound to this ACP session."""
        return self._cli

    async def prompt(self, prompt: list[Any]) -> acp.PromptResponse:
        system_texts: list[str] = []
        user_prompt: list[ACPContentBlock] = []
        for block in prompt:
            if isinstance(block, dict) and block.get("type") == "system_text":
                text = block.get("text")
                if isinstance(text, str) and text.strip():
                    system_texts.append(text.strip())
                continue
            user_prompt.append(block)
        if system_texts:
            await self._cli.soul.context.append_message(
                Message(
                    role="system",
                    content=[TextPart(text="\n".join(system_texts))],
                )
            )
        user_input = acp_blocks_to_content_parts(user_prompt)
        self._turn_state = _TurnState()
        self._subagent_names.clear()
        self._subagent_started.clear()
        self._subagent_tool_calls.clear()
        token = _current_turn_id.set(self._turn_state.id)
        kaos_token = set_current_kaos(self._kaos) if self._kaos is not None else None
        terminal_tool_calls_token = _terminal_tool_call_ids.set(set())
        try:
            async for msg in self._cli.run(
                user_input,
                self._turn_state.cancel_event,
                wire_file=self._cli.soul.wire_file,
            ):
                match msg:
                    case TurnBegin():
                        pass
                    case SteerInput():
                        pass
                    case TurnEnd():
                        pass
                    case StepBegin():
                        pass
                    case StepInterrupted():
                        break
                    case CompactionBegin():
                        pass
                    case CompactionEnd():
                        pass
                    case HookTriggered():
                        pass
                    case HookResolved():
                        pass
                    case MCPLoadingBegin():
                        pass
                    case MCPLoadingEnd():
                        pass
                    case StatusUpdate():
                        pass
                    case Notification():
                        await self._send_notification(msg)
                    case ThinkPart(think=think):
                        await self._send_thinking(think)
                    case TextPart(text=text):
                        await self._send_text(text)
                    case ContentPart():
                        logger.warning("Unsupported content part: {part}", part=msg)
                        await self._send_text(f"[{msg.__class__.__name__}]")
                    case ToolCall():
                        await self._send_tool_call(msg)
                    case ToolCallPart():
                        await self._send_tool_call_part(msg)
                    case ToolResult():
                        await self._send_tool_result(msg)
                    case ApprovalResponse():
                        pass
                    case SubagentEvent():
                        await self._send_subagent_event(msg)
                    case PlanDisplay():
                        await self._send_text(msg.content)
                    case BtwBegin():
                        pass
                    case BtwEnd():
                        if msg.response:
                            await self._send_text(msg.response)
                    case ApprovalRequest():
                        await self._handle_approval_request(msg)
                    case QuestionRequest():
                        logger.warning(
                            "QuestionRequest is unsupported in ACP session; resolving empty answer."
                        )
                        msg.resolve({})
                    case HookRequest():
                        logger.warning(
                            "HookRequest is unsupported in ACP session; allowing by default."
                        )
                        msg.resolve("allow")
                    case ToolCallRequest():
                        logger.warning("Unexpected ToolCallRequest in ACP session: {msg}", msg=msg)
        except LLMNotSet as e:
            logger.exception("LLM not set:")
            raise acp.RequestError.auth_required() from e
        except LLMNotSupported as e:
            logger.exception("LLM not supported:")
            raise acp.RequestError.internal_error({"error": str(e)}) from e
        except ChatProviderError as e:
            logger.exception("LLM provider error:")
            raise acp.RequestError.internal_error({"error": str(e)}) from e
        except MaxStepsReached as e:
            logger.warning("Max steps reached: {n_steps}", n_steps=e.n_steps)
            return acp.PromptResponse(stop_reason="max_turn_requests")
        except RunCancelled:
            logger.info("Prompt cancelled by user")
            return acp.PromptResponse(stop_reason="cancelled")
        except Exception as e:
            logger.exception("Unexpected error during prompt:")
            raise acp.RequestError.internal_error({"error": str(e)}) from e
        finally:
            self._turn_state = None
            if kaos_token is not None:
                reset_current_kaos(kaos_token)
            _terminal_tool_call_ids.reset(terminal_tool_calls_token)
            _current_turn_id.reset(token)
        return acp.PromptResponse(stop_reason="end_turn")

    async def cancel(self) -> None:
        if self._turn_state is None:
            logger.warning("Cancel requested but no prompt is running")
            return

        self._turn_state.cancel_event.set()

    async def _send_thinking(self, think: str):
        """Send thinking content to client."""
        if not self._id or not self._conn:
            return

        await self._conn.session_update(
            self._id,
            acp.schema.AgentThoughtChunk(
                content=acp.schema.TextContentBlock(type="text", text=think),
                session_update="agent_thought_chunk",
            ),
        )

    async def _send_text(self, text: str):
        """Send text chunk to client."""
        if not self._id or not self._conn:
            return

        await self._conn.session_update(
            session_id=self._id,
            update=acp.schema.AgentMessageChunk(
                content=acp.schema.TextContentBlock(type="text", text=text),
                session_update="agent_message_chunk",
            ),
        )

    async def _send_notification(self, notification: Notification):
        """Send a system notification to client as a text chunk."""
        body = notification.body.strip()
        text = f"[Notification] {notification.title}"
        if body:
            text = f"{text}\n{body}"
        await self._send_text(text)

    async def _send_tool_call(self, tool_call: ToolCall):
        """Send tool call to client."""
        assert self._turn_state is not None
        if not self._id or not self._conn:
            return

        # Create and store tool call state
        state = _ToolCallState(tool_call)
        self._turn_state.tool_calls[tool_call.id] = state
        self._turn_state.last_tool_call = state
        self._cache_subagent_name(state)

        await self._conn.session_update(
            session_id=self._id,
            update=acp.schema.ToolCallStart(
                session_update="tool_call",
                tool_call_id=state.acp_tool_call_id,
                title=state.get_title(),
                status="in_progress",
                content=[
                    acp.schema.ContentToolCallContent(
                        type="content",
                        content=acp.schema.TextContentBlock(type="text", text=state.args),
                    )
                ],
            ),
        )
        logger.debug("Sent tool call: {name}", name=tool_call.function.name)

    async def _send_tool_call_part(self, part: ToolCallPart):
        """Send tool call part (streaming arguments)."""
        assert self._turn_state is not None
        if (
            not self._id
            or not self._conn
            or not part.arguments_part
            or self._turn_state.last_tool_call is None
        ):
            return

        # Append new arguments part to the last tool call
        self._turn_state.last_tool_call.append_args_part(part.arguments_part)
        self._cache_subagent_name(self._turn_state.last_tool_call)

        # Update the tool call with new content and title
        update = acp.schema.ToolCallProgress(
            session_update="tool_call_update",
            tool_call_id=self._turn_state.last_tool_call.acp_tool_call_id,
            title=self._turn_state.last_tool_call.get_title(),
            status="in_progress",
            content=[
                acp.schema.ContentToolCallContent(
                    type="content",
                    content=acp.schema.TextContentBlock(
                        type="text", text=self._turn_state.last_tool_call.args
                    ),
                )
            ],
        )

        await self._conn.session_update(session_id=self._id, update=update)
        logger.debug("Sent tool call update: {delta}", delta=part.arguments_part[:50])

    async def _send_tool_result(self, result: ToolResult):
        """Send tool result to client."""
        assert self._turn_state is not None
        if not self._id or not self._conn:
            return

        tool_ret = result.return_value

        state = self._turn_state.tool_calls.pop(result.tool_call_id, None)
        if state is None:
            logger.warning("Tool call not found: {id}", id=result.tool_call_id)
            return

        update = acp.schema.ToolCallProgress(
            session_update="tool_call_update",
            tool_call_id=state.acp_tool_call_id,
            status="failed" if tool_ret.is_error else "completed",
        )

        contents = (
            []
            if should_hide_terminal_output(state.acp_tool_call_id)
            else tool_result_to_acp_content(tool_ret)
        )
        if contents:
            update.content = contents

        await self._conn.session_update(session_id=self._id, update=update)
        logger.debug("Sent tool result: {id}", id=result.tool_call_id)
        await self._send_subagent_end(state)

        for block in tool_ret.display:
            if isinstance(block, TodoDisplayBlock):
                await self._send_plan_update(block)

    async def _handle_approval_request(self, request: ApprovalRequest):
        """Handle approval request by sending permission request to client."""
        assert self._turn_state is not None
        if not self._id or not self._conn:
            logger.warning("No session ID, auto-rejecting approval request")
            request.resolve("reject")
            return

        if not request.tool_call_id:
            logger.warning("Approval request missing tool_call_id")
            request.resolve("reject")
            return

        state = self._turn_state.tool_calls.get(request.tool_call_id, None)
        tool_call_id = state.acp_tool_call_id if state is not None else None
        if state is None:
            state, tool_call_id = self._find_subagent_tool_call_state(request.tool_call_id)
        if not tool_call_id:
            tool_call_id = request.tool_call_id
        title = state.get_title() if state is not None else request.action or "approval"

        try:
            content: list[
                acp.schema.ContentToolCallContent
                | acp.schema.FileEditToolCallContent
                | acp.schema.TerminalToolCallContent
            ] = []
            if request.display:
                for block in request.display:
                    diff_content = display_block_to_acp_content(block)
                    if diff_content is not None:
                        content.append(diff_content)
            if not content:
                content.append(
                    acp.schema.ContentToolCallContent(
                        type="content",
                        content=acp.schema.TextContentBlock(
                            type="text",
                            text=f"Requesting approval to perform: {request.description}",
                        ),
                    )
                )

            # Send permission request and wait for response
            logger.info(
                "ACP permission request start: session={session} tool_call={tool_call} action={action}",
                session=self._id,
                tool_call=tool_call_id,
                action=request.action,
            )
            response = await self._conn.request_permission(
                [
                    acp.schema.PermissionOption(
                        option_id="approve",
                        name="Approve once",
                        kind="allow_once",
                    ),
                    acp.schema.PermissionOption(
                        option_id="approve_for_session",
                        name="Approve for this session",
                        kind="allow_always",
                    ),
                    acp.schema.PermissionOption(
                        option_id="reject",
                        name="Reject",
                        kind="reject_once",
                    ),
                ],
                self._id,
                acp.schema.ToolCallUpdate(
                    tool_call_id=tool_call_id,
                    title=title,
                    content=content,
                ),
            )
            logger.info(
                "ACP permission response received: session={session} tool_call={tool_call} response={response}",
                session=self._id,
                tool_call=tool_call_id,
                response=response,
            )

            # Process the outcome
            if isinstance(response.outcome, acp.schema.AllowedOutcome):
                # selected
                option_id = response.outcome.option_id
                if option_id == "approve":
                    logger.info(
                        "ACP permission approved once: session={session} tool_call={tool_call} action={action}",
                        session=self._id,
                        tool_call=tool_call_id,
                        action=request.action,
                    )
                    request.resolve("approve")
                elif option_id == "approve_for_session":
                    logger.info(
                        "ACP permission approved for session: session={session} tool_call={tool_call} action={action}",
                        session=self._id,
                        tool_call=tool_call_id,
                        action=request.action,
                    )
                    request.resolve("approve_for_session")
                else:
                    logger.info(
                        "ACP permission rejected: session={session} tool_call={tool_call} action={action}",
                        session=self._id,
                        tool_call=tool_call_id,
                        action=request.action,
                    )
                    request.resolve("reject")
            else:
                # cancelled
                logger.info(
                    "ACP permission cancelled: session={session} tool_call={tool_call} action={action}",
                    session=self._id,
                    tool_call=tool_call_id,
                    action=request.action,
                )
                request.resolve("reject")
        except Exception:
            logger.exception("Error handling approval request:")
            # On error, reject the request
            request.resolve("reject")

    async def _send_plan_update(self, block: TodoDisplayBlock) -> None:
        """Send todo list updates as ACP agent plan updates."""

        status_map: dict[str, acp.schema.PlanEntryStatus] = {
            "pending": "pending",
            "in progress": "in_progress",
            "in_progress": "in_progress",
            "done": "completed",
            "completed": "completed",
        }
        entries: list[acp.schema.PlanEntry] = [
            acp.schema.PlanEntry(
                content=todo.title,
                priority="medium",
                status=status_map.get(todo.status.lower(), "pending"),
            )
            for todo in block.items
            if todo.title
        ]

        if not entries:
            logger.warning("No valid todo items to send in plan update: {todos}", todos=block.items)
            return

        await self._conn.session_update(
            session_id=self._id,
            update=acp.schema.AgentPlanUpdate(session_update="plan", entries=entries),
        )

    def _cache_subagent_name(self, state: _ToolCallState) -> None:
        if state.tool_call.function.name not in {"Task", "Agent"}:
            return
        args = state.args.strip()
        if not args:
            return
        try:
            payload = json.loads(args)
        except json.JSONDecodeError:
            return
        name = (
            payload.get("subagent_name")
            or payload.get("subagentName")
            or payload.get("subagent_type")
            or payload.get("subagentType")
        )
        if isinstance(name, str) and name:
            self._subagent_names[state.tool_call.id] = name

    async def _send_subagent_event(self, event: SubagentEvent) -> None:
        if not self._id or not self._conn:
            return
        update = self._map_subagent_event(event)
        if update is None:
            return
        await self._conn.session_update(session_id=self._id, update=update)

    def _map_subagent_event(self, event: SubagentEvent) -> dict[str, Any] | None:
        sub_event = event.event
        parent_tool_call_id = event.parent_tool_call_id
        if isinstance(sub_event, TurnBegin):
            if parent_tool_call_id in self._subagent_started:
                return None
            self._subagent_started.add(parent_tool_call_id)
            return {
                "session_update": "subagent_event",
                "task_tool_call_id": parent_tool_call_id,
                "name": self._subagent_names.get(parent_tool_call_id, ""),
                "status": "begin",
            }
        if isinstance(sub_event, TextPart):
            text = sub_event.text.strip()
            return {
                "session_update": "subagent_event",
                "task_tool_call_id": parent_tool_call_id,
                "name": self._subagent_names.get(parent_tool_call_id, ""),
                "status": "update",
                "text": text if text else None,
            }
        if isinstance(sub_event, ToolCall):
            state = _ToolCallState(sub_event)
            self._subagent_tool_calls[self._subagent_tool_key(event, sub_event.id)] = state
            return {
                "session_update": "subagent_event",
                "kind": "tool_call",
                "task_tool_call_id": parent_tool_call_id,
                "name": self._subagent_names.get(parent_tool_call_id, ""),
                "tool_call_id": self._subagent_tool_call_id(event, sub_event.id),
                "title": state.get_title(),
                "status": "in_progress",
                "args": state.args or None,
            }
        if isinstance(sub_event, ToolCallPart):
            key = self._subagent_tool_key(event, sub_event.tool_call_id)
            state = self._subagent_tool_calls.get(key)
            if state is None:
                return None
            if sub_event.arguments_part:
                state.append_args_part(sub_event.arguments_part)
            return {
                "session_update": "subagent_event",
                "kind": "tool_call_update",
                "task_tool_call_id": parent_tool_call_id,
                "name": self._subagent_names.get(parent_tool_call_id, ""),
                "tool_call_id": self._subagent_tool_call_id(event, sub_event.tool_call_id),
                "title": state.get_title(),
                "status": "in_progress",
                "args": state.args or None,
            }
        if isinstance(sub_event, ToolResult):
            key = self._subagent_tool_key(event, sub_event.tool_call_id)
            state = self._subagent_tool_calls.pop(key, None)
            if state is None:
                return None
            tool_ret = sub_event.return_value
            return {
                "session_update": "subagent_event",
                "kind": "tool_call_update",
                "task_tool_call_id": parent_tool_call_id,
                "name": self._subagent_names.get(parent_tool_call_id, ""),
                "tool_call_id": self._subagent_tool_call_id(event, sub_event.tool_call_id),
                "title": state.get_title(),
                "status": "failed" if tool_ret.is_error else "completed",
            }
        return None

    @staticmethod
    def _subagent_tool_key(event: SubagentEvent, tool_call_id: str) -> str:
        return f"{event.parent_tool_call_id}/{tool_call_id}"

    def _subagent_tool_call_id(self, event: SubagentEvent, tool_call_id: str) -> str:
        return f"subagent/{event.parent_tool_call_id}/{tool_call_id}"

    def _find_subagent_tool_call_state(
        self, tool_call_id: str
    ) -> tuple[_ToolCallState | None, str | None]:
        for key, state in self._subagent_tool_calls.items():
            if state.tool_call.id != tool_call_id:
                continue
            task_tool_call_id = key.split("/", 1)[0]
            return state, f"subagent/{task_tool_call_id}/{tool_call_id}"
        return None, None

    async def _send_subagent_end(self, state: _ToolCallState) -> None:
        if state.tool_call.function.name not in {"Task", "Agent"}:
            return
        if not self._id or not self._conn:
            return
        if state.tool_call.id not in self._subagent_names:
            return
        update: dict[str, Any] = {
            "session_update": "subagent_event",
            "task_tool_call_id": state.tool_call.id,
            "name": self._subagent_names.get(state.tool_call.id, ""),
            "status": "end",
        }
        await self._conn.session_update(session_id=self._id, update=update)
