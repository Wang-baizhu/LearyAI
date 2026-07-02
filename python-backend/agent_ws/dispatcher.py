# 该文件职责：提供 websocket 命令分发与注册。

from __future__ import annotations

from dataclasses import dataclass
from functools import partial
from typing import Any, Awaitable, Callable

from agent_ws.schemas.context import ConnectionContext
from agent_ws.adapters.wire_session import WireSessionAdapter
from agent_ws.handlers import agent as agent_handler
from agent_ws.handlers import hook as hook_handler
from agent_ws.handlers import permission as permission_handler
from agent_ws.handlers import question as question_handler
from agent_ws.handlers import session as session_handler
from agent_ws.handlers import skills as skills_handler
from agent_ws.handlers import tool as tool_handler
from agent_ws.state.manager import AgentStateManager

Handler = Callable[[dict[str, Any], dict[str, Any], ConnectionContext], Awaitable[list[dict[str, Any]]]]


@dataclass
class CommandDispatcher:
    handlers: dict[str, Handler]
    session_adapter: WireSessionAdapter | None = None

    async def dispatch(
        self,
        cmd: str,
        payload: dict[str, Any],
        meta: dict[str, Any],
        context: ConnectionContext,
    ) -> list[dict[str, Any]]:
        handler = self.handlers.get(cmd)
        if handler is None:
            return [
                {
                    "event": "error",
                    "payload": {"code": "unknown_cmd", "message": f"Unknown cmd: {cmd}"},
                    "meta": {"userId": context.user_id},
                }
            ]
        return await handler(payload, meta, context)


def create_default_dispatcher(
    state_manager: AgentStateManager,
    session_adapter: WireSessionAdapter,
) -> CommandDispatcher:
    return CommandDispatcher(
        session_adapter=session_adapter,
        handlers={
            "agent.query": partial(
                agent_handler.query, session_adapter=session_adapter, state_manager=state_manager
            ),
            "agent.cancel": partial(
                agent_handler.cancel, session_adapter=session_adapter, state_manager=state_manager
            ),
            "session.create": partial(
                session_handler.create, session_adapter=session_adapter, state_manager=state_manager
            ),
            "session.list": partial(
                session_handler.list_sessions,
                session_adapter=session_adapter,
                state_manager=state_manager,
            ),
            "session.subagent_list": partial(
                session_handler.list_subagents,
                session_adapter=session_adapter,
                state_manager=state_manager,
            ),
            "session.delete": partial(
                session_handler.delete, session_adapter=session_adapter, state_manager=state_manager
            ),
            "session.rename": partial(
                session_handler.rename, session_adapter=session_adapter, state_manager=state_manager
            ),
            "session.status": partial(
                session_handler.status, session_adapter=session_adapter, state_manager=state_manager
            ),
            "session.context": partial(
                session_handler.context, session_adapter=session_adapter, state_manager=state_manager
            ),
            "session.subagent_context": partial(
                session_handler.subagent_context,
                session_adapter=session_adapter,
                state_manager=state_manager,
            ),
            "permission.respond": partial(
                permission_handler.respond, session_adapter=session_adapter
            ),
            "question.respond": partial(
                question_handler.respond, session_adapter=session_adapter
            ),
            "hook.respond": partial(
                hook_handler.respond, session_adapter=session_adapter
            ),
            "tool.respond": partial(
                tool_handler.respond, session_adapter=session_adapter
            ),
            "skills.load": skills_handler.load,
            "skills.install": skills_handler.install,
            "skills.uninstall": skills_handler.uninstall,
        }
    )
