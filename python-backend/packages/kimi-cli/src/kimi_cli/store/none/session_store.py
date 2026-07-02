# Responsibilities: noop session store that does not persist session data.
from __future__ import annotations

from pathlib import Path
from typing import Protocol

from kimi_cli.session_state import SessionState


class WorkDirMetaLike(Protocol):
    @property
    def sessions_dir(self) -> Path:
        raise NotImplementedError


class SessionStore(Protocol):
    async def ensure_session_dir(
        self, work_dir_meta: WorkDirMetaLike, session_id: str, *, hidden: bool = False
    ) -> Path:
        raise NotImplementedError

    def resolve_context_file(self, session_dir: Path, override: Path | None) -> Path:
        raise NotImplementedError

    async def ensure_context_file(self, context_file: Path) -> None:
        raise NotImplementedError

    def wire_file_path(self, session_dir: Path) -> Path:
        raise NotImplementedError

    async def load_session_state(
        self, work_dir_meta: WorkDirMetaLike, session_id: str
    ) -> SessionState:
        raise NotImplementedError

    async def save_session_state(
        self, work_dir_meta: WorkDirMetaLike, session_id: str, state: SessionState
    ) -> None:
        raise NotImplementedError

    async def session_dir_exists(self, work_dir_meta: WorkDirMetaLike, session_id: str) -> bool:
        raise NotImplementedError

    async def context_file_exists(self, work_dir_meta: WorkDirMetaLike, session_id: str) -> bool:
        raise NotImplementedError

    async def list_session_ids(self, work_dir_meta: WorkDirMetaLike) -> set[str]:
        raise NotImplementedError

    async def get_all_sessions(
        self,
        user_id: str,
        *,
        kb_id: str | None = None,
        limit: int | None = None,
        cursor: str | None = None,
    ) -> list[dict[str, object]]:
        raise NotImplementedError

    async def get_session_context(self, session_id: str) -> list[dict[str, object]]:
        raise NotImplementedError

    async def rename_by_sessionId(self, user_id: str, session_id: str, name: str) -> bool:
        raise NotImplementedError

    async def delete_session_dir(self, work_dir_meta: WorkDirMetaLike, session_id: str) -> None:
        raise NotImplementedError

    def migrate_context_file(self, work_dir_meta: WorkDirMetaLike, session_id: str) -> None:
        raise NotImplementedError


class NoneSessionStore:
    def __init__(self) -> None:
        self._states: dict[str, SessionState] = {}

    async def ensure_session_dir(
        self, work_dir_meta: WorkDirMetaLike, session_id: str, *, hidden: bool = False
    ) -> Path:
        _ = (work_dir_meta, hidden)
        return Path(".none-sessions") / session_id

    def resolve_context_file(self, session_dir: Path, override: Path | None) -> Path:
        if override is None:
            return session_dir / "context.jsonl"
        return override

    async def ensure_context_file(self, context_file: Path) -> None:
        _ = context_file
        return None

    def wire_file_path(self, session_dir: Path) -> Path:
        return session_dir / "wire.jsonl"

    async def load_session_state(
        self, work_dir_meta: WorkDirMetaLike, session_id: str
    ) -> SessionState:
        _ = work_dir_meta
        return self._states.get(session_id, SessionState()).model_copy(deep=True)

    async def save_session_state(
        self, work_dir_meta: WorkDirMetaLike, session_id: str, state: SessionState
    ) -> None:
        _ = work_dir_meta
        self._states[session_id] = state.model_copy(deep=True)

    async def session_dir_exists(self, work_dir_meta: WorkDirMetaLike, session_id: str) -> bool:
        _ = (work_dir_meta, session_id)
        return False

    async def context_file_exists(self, work_dir_meta: WorkDirMetaLike, session_id: str) -> bool:
        _ = (work_dir_meta, session_id)
        return False

    async def list_session_ids(self, work_dir_meta: WorkDirMetaLike) -> set[str]:
        _ = work_dir_meta
        return set()

    async def get_all_sessions(
        self,
        user_id: str,
        *,
        kb_id: str | None = None,
        limit: int | None = None,
        cursor: str | None = None,
    ) -> list[dict[str, object]]:
        _ = (user_id, kb_id, limit, cursor)
        return []

    async def get_session_context(self, session_id: str) -> list[dict[str, object]]:
        _ = session_id
        return []

    async def rename_by_sessionId(self, user_id: str, session_id: str, name: str) -> bool:
        _ = (user_id, session_id, name)
        return False

    async def delete_session_dir(self, work_dir_meta: WorkDirMetaLike, session_id: str) -> None:
        _ = (work_dir_meta, session_id)
        return None

    def migrate_context_file(self, work_dir_meta: WorkDirMetaLike, session_id: str) -> None:
        _ = (work_dir_meta, session_id)
        return None


_session_store: SessionStore = NoneSessionStore()


def get_session_store() -> SessionStore:
    return _session_store
