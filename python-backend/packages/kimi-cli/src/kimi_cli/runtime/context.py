# Responsibilities: store request-scoped runtime context for tools.
from __future__ import annotations

from contextvars import ContextVar, Token
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from kimi_cli.session import Session


@dataclass(frozen=True)
class RuntimeContext:
    user_id: str | None
    project_id: str | None
    kb_id: str | None


_current_context: ContextVar[RuntimeContext | None] = ContextVar(
    "kimi_runtime_context",
    default=None,
)
_current_session: ContextVar[Session | None] = ContextVar(
    "kimi_runtime_session",
    default=None,
)


def set_current_context(context: RuntimeContext | None) -> Token[RuntimeContext | None]:
    return _current_context.set(context)


def reset_current_context(token: Token[RuntimeContext | None]) -> None:
    _current_context.reset(token)


def get_current_context() -> RuntimeContext | None:
    return _current_context.get()


def set_current_session(session: Session | None) -> Token[Session | None]:
    return _current_session.set(session)


def reset_current_session(token: Token[Session | None]) -> None:
    _current_session.reset(token)


def get_current_session() -> Session | None:
    return _current_session.get()
