# Responsibilities: abstract session filesystem IO (directories, state, and context/wire files).
from __future__ import annotations

import asyncio
import json
import shutil
from pathlib import Path
from typing import Protocol

from pydantic import ValidationError

from kimi_cli.session_state import SessionState
from kimi_cli.utils.io import atomic_json_write
from kimi_cli.utils.logging import logger


STATE_FILE_NAME = "state.json"


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


class FileSessionStore:
    async def ensure_session_dir(
        self, work_dir_meta: WorkDirMetaLike, session_id: str, *, hidden: bool = False
    ) -> Path:
        _ = hidden
        session_dir = work_dir_meta.sessions_dir / session_id
        await asyncio.to_thread(session_dir.mkdir, parents=True, exist_ok=True)
        return session_dir

    def resolve_context_file(self, session_dir: Path, override: Path | None) -> Path:
        if override is None:
            return session_dir / "context.jsonl"
        override.parent.mkdir(parents=True, exist_ok=True)
        if override.exists():
            assert override.is_file()
        return override

    async def ensure_context_file(self, context_file: Path) -> None:
        if await asyncio.to_thread(context_file.exists):
            await asyncio.to_thread(context_file.unlink)
        await asyncio.to_thread(context_file.touch)

    def wire_file_path(self, session_dir: Path) -> Path:
        return session_dir / "wire.jsonl"

    async def load_session_state(
        self, work_dir_meta: WorkDirMetaLike, session_id: str
    ) -> SessionState:
        state_file = work_dir_meta.sessions_dir / session_id / STATE_FILE_NAME
        if not await asyncio.to_thread(state_file.exists):
            return SessionState()
        try:
            data = await asyncio.to_thread(state_file.read_text, encoding="utf-8")
            return SessionState.model_validate(json.loads(data))
        except (OSError, json.JSONDecodeError, UnicodeDecodeError, ValidationError):
            logger.warning("Corrupted state file, using defaults: {path}", path=state_file)
            return SessionState()

    async def save_session_state(
        self, work_dir_meta: WorkDirMetaLike, session_id: str, state: SessionState
    ) -> None:
        state_file = work_dir_meta.sessions_dir / session_id / STATE_FILE_NAME
        await asyncio.to_thread(state_file.parent.mkdir, parents=True, exist_ok=True)
        await asyncio.to_thread(atomic_json_write, state.model_dump(mode="json"), state_file)

    async def session_dir_exists(self, work_dir_meta: WorkDirMetaLike, session_id: str) -> bool:
        return await asyncio.to_thread((work_dir_meta.sessions_dir / session_id).is_dir)

    async def context_file_exists(self, work_dir_meta: WorkDirMetaLike, session_id: str) -> bool:
        return await asyncio.to_thread(
            (work_dir_meta.sessions_dir / session_id / "context.jsonl").exists
        )

    async def list_session_ids(self, work_dir_meta: WorkDirMetaLike) -> set[str]:
        def _list() -> set[str]:
            return {
                path.name if path.is_dir() else path.stem
                for path in work_dir_meta.sessions_dir.iterdir()
                if path.is_dir() or path.suffix == ".jsonl"
            }

        return await asyncio.to_thread(_list)

    async def get_all_sessions(
        self,
        user_id: str,
        *,
        kb_id: str | None = None,
        limit: int | None = None,
        cursor: str | None = None,
    ) -> list[dict[str, object]]:
        _ = (kb_id, limit, cursor)
        return []

    async def get_session_context(self, session_id: str) -> list[dict[str, object]]:
        return []

    async def rename_by_sessionId(self, user_id: str, session_id: str, name: str) -> bool:
        return False

    async def delete_session_dir(self, work_dir_meta: WorkDirMetaLike, session_id: str) -> None:
        session_dir = work_dir_meta.sessions_dir / session_id
        if not await asyncio.to_thread(session_dir.exists):
            return
        await asyncio.to_thread(shutil.rmtree, session_dir, True)

    def migrate_context_file(self, work_dir_meta: WorkDirMetaLike, session_id: str) -> None:
        old_context_file = work_dir_meta.sessions_dir / f"{session_id}.jsonl"
        new_context_file = work_dir_meta.sessions_dir / session_id / "context.jsonl"
        if old_context_file.exists() and not new_context_file.exists():
            new_context_file.parent.mkdir(parents=True, exist_ok=True)
            old_context_file.rename(new_context_file)


_session_store: SessionStore = FileSessionStore()


def get_session_store() -> SessionStore:
    return _session_store


def set_session_store(store: SessionStore) -> None:
    global _session_store
    _session_store = store
