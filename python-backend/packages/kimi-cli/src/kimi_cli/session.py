"""Responsibilities: represent sessions and delegate session IO to the store layer."""
from __future__ import annotations

import asyncio
import builtins
import os
import uuid
from dataclasses import dataclass
from pathlib import Path
from textwrap import shorten

from kaos.path import KaosPath
from kosong.message import Message

from kimi_cli.metadata import WorkDirMeta, load_metadata, save_metadata
from kimi_cli.session_state import SessionState
from kimi_cli.store import get_session_store, get_store_kind
from kimi_cli.store.target import StoreTarget
from kimi_cli.store.rdb.runtime import get_latest_session_id, get_session_updated_at
from kimi_cli.utils.logging import logger
from kimi_cli.wire.file import WireFile
from kimi_cli.wire.types import TurnBegin


@dataclass(slots=True, kw_only=True)
class Session:
    """A session of a work directory."""

    # static metadata
    id: str
    """The session ID."""
    work_dir: KaosPath
    """The absolute path of the work directory."""
    work_dir_meta: WorkDirMeta
    """The metadata of the work directory."""
    context_file: Path
    """The absolute path to the file storing the message history."""
    wire_file: WireFile
    """The wire message log file wrapper."""
    state: SessionState
    """Persisted session state (approval settings, plan mode, todos, etc.)."""

    # refreshable metadata
    title: str
    """The title of the session."""
    updated_at: float
    """The timestamp of the last update to the session."""

    @property
    def dir(self) -> Path:
        """The absolute path of the session directory."""
        path = self.work_dir_meta.sessions_dir / self.id
        path.mkdir(parents=True, exist_ok=True)
        return path

    async def is_empty(self) -> bool:
        """Whether the session has any context history."""
        if self.state.custom_title:
            return False
        if not await self.wire_file.is_empty():
            return False
        if get_store_kind() == "rdb":
            return True
        try:
            return self.context_file.stat().st_size == 0
        except FileNotFoundError:
            return True

    async def delete(self) -> None:
        """Delete the session directory."""
        store = get_session_store()
        await store.delete_session_dir(self.work_dir_meta, self.id)
        if get_store_kind() != "rdb":
            await self._clear_last_session_marker_if_needed()

    async def refresh(self) -> None:
        self.title = f"Untitled ({self.id})"
        if get_store_kind() == "rdb":
            self.updated_at = await get_session_updated_at(self.id) or 0.0
        else:
            self.updated_at = (
                self.context_file.stat().st_mtime if self.context_file.exists() else 0.0
            )
        if self.state.custom_title:
            self.title = self.state.custom_title
            return

        try:
            async for record in self.wire_file.iter_records():
                wire_msg = record.to_wire_message()
                if isinstance(wire_msg, TurnBegin):
                    title = shorten(
                        Message(role="user", content=wire_msg.user_input).extract_text(" "),
                        width=50,
                    )
                    self.title = f"{title} ({self.id})"
                    return
        except Exception:
            logger.exception(
                "Failed to derive session title from wire file {file}:",
                file=self.wire_file.path,
            )

    @staticmethod
    async def create(
        work_dir: KaosPath,
        session_id: str | None = None,
        _context_file: Path | None = None,
    ) -> Session:
        """Create a new session for a work directory."""
        if session_id is None:
            session_id = str(uuid.uuid4())
        if get_store_kind() == "rdb":
            work_dir = _resolve_rdb_work_dir_for_session(session_id)
            work_dir_meta = _rdb_work_dir_meta()
        else:
            work_dir = work_dir.canonical()
            metadata = await load_metadata()
            work_dir_meta = metadata.get_or_create_work_dir_meta(work_dir)
        logger.debug("Creating new session for work directory: {work_dir}", work_dir=work_dir)

        store = get_session_store()
        session_dir = await store.ensure_session_dir(work_dir_meta, session_id)

        if _context_file is None:
            context_file = store.resolve_context_file(session_dir, None)
        else:
            logger.warning(
                "Using provided context file: {context_file}", context_file=_context_file
            )
            context_file = store.resolve_context_file(session_dir, _context_file)

        if get_store_kind() != "rdb" and context_file.exists():
            # truncate if exists
            logger.warning(
                "Context file already exists, truncating: {context_file}", context_file=context_file
            )
        await store.ensure_context_file(context_file)

        if get_store_kind() != "rdb":
            await save_metadata(metadata)

        wire_path = store.wire_file_path(session_dir)
        wire_file = await WireFile.create(
            StoreTarget(kind="session", session_id=session_id, path=wire_path)
        )

        session = Session(
            id=session_id,
            work_dir=work_dir,
            work_dir_meta=work_dir_meta,
            context_file=context_file,
            wire_file=wire_file,
            state=SessionState(),
            title="",
            updated_at=0.0,
        )
        await session.refresh()
        if get_store_kind() != "rdb":
            await session.mark_as_last_session(metadata=metadata)
        return session

    @staticmethod
    async def find(work_dir: KaosPath, session_id: str) -> Session | None:
        """Find a session by work directory and session ID."""
        if get_store_kind() == "rdb":
            work_dir = _resolve_rdb_work_dir_for_session(session_id)
        else:
            work_dir = work_dir.canonical()
        logger.debug(
            "Finding session for work directory: {work_dir}, session ID: {session_id}",
            work_dir=work_dir,
            session_id=session_id,
        )

        if get_store_kind() == "rdb":
            work_dir_meta = _rdb_work_dir_meta()
        else:
            metadata = await load_metadata()
            work_dir_meta = metadata.get_work_dir_meta(work_dir)
            if work_dir_meta is None:
                logger.debug("Work directory never been used")
                return None
        store = get_session_store()
        _migrate_session_context_file(work_dir_meta, session_id)
        session_dir = work_dir_meta.sessions_dir / session_id
        if not await store.session_dir_exists(work_dir_meta, session_id):
            logger.debug("Session directory not found: {session_dir}", session_dir=session_dir)
            return None
        context_file = session_dir / "context.jsonl"
        if get_store_kind() != "rdb" and not await store.context_file_exists(work_dir_meta, session_id):
            logger.debug(
                "Session context file not found: {context_file}", context_file=context_file
            )
            return None

        wire_path = store.wire_file_path(session_dir)
        wire_file = await WireFile.create(
            StoreTarget(kind="session", session_id=session_id, path=wire_path)
        )
        session = Session(
            id=session_id,
            work_dir=work_dir,
            work_dir_meta=work_dir_meta,
            context_file=context_file,
            wire_file=wire_file,
            state=await store.load_session_state(work_dir_meta, session_id),
            title="",
            updated_at=0.0,
        )
        await session.refresh()
        return session

    @staticmethod
    async def list(work_dir: KaosPath) -> builtins.list[Session]:
        """List all sessions for a work directory."""
        if get_store_kind() == "rdb":
            base_work_dir = _resolve_rdb_work_dir_base()
            work_dir = KaosPath.unsafe_from_local_path(base_work_dir)
        else:
            work_dir = work_dir.canonical()
        logger.debug("Listing sessions for work directory: {work_dir}", work_dir=work_dir)

        if get_store_kind() == "rdb":
            work_dir_meta = _rdb_work_dir_meta()
        else:
            metadata = await load_metadata()
            work_dir_meta = metadata.get_work_dir_meta(work_dir)
            if work_dir_meta is None:
                logger.debug("Work directory never been used")
                return []
        store = get_session_store()
        session_ids = await store.list_session_ids(work_dir_meta)

        sessions: list[Session] = []
        for session_id in session_ids:
            _migrate_session_context_file(work_dir_meta, session_id)
            session_dir = work_dir_meta.sessions_dir / session_id
            if not await store.session_dir_exists(work_dir_meta, session_id):
                logger.debug("Session directory not found: {session_dir}", session_dir=session_dir)
                continue
            context_file = session_dir / "context.jsonl"
            if get_store_kind() != "rdb" and not await store.context_file_exists(
                work_dir_meta, session_id
            ):
                logger.debug(
                    "Session context file not found: {context_file}", context_file=context_file
                )
                continue
            session_work_dir = (
                _resolve_rdb_work_dir_for_session(session_id)
                if get_store_kind() == "rdb"
                else work_dir
            )
            wire_path = store.wire_file_path(session_dir)
            wire_file = await WireFile.create(
                StoreTarget(kind="session", session_id=session_id, path=wire_path)
            )
            session = Session(
                id=session_id,
                work_dir=session_work_dir,
                work_dir_meta=work_dir_meta,
                context_file=context_file,
                wire_file=wire_file,
                state=await store.load_session_state(work_dir_meta, session_id),
                title="",
                updated_at=0.0,
            )
            if await session.is_empty():
                logger.debug(
                    "Session has no persisted records: {session_id}", session_id=session_id
                )
                continue
            await session.refresh()
            sessions.append(session)
        sessions.sort(key=lambda session: session.updated_at, reverse=True)
        return sessions

    @staticmethod
    async def continue_(work_dir: KaosPath) -> Session | None:
        """Get the last session for a work directory."""
        if get_store_kind() == "rdb":
            work_dir = KaosPath.unsafe_from_local_path(_resolve_rdb_work_dir_base())
        else:
            work_dir = work_dir.canonical()
        logger.debug("Continuing session for work directory: {work_dir}", work_dir=work_dir)

        if get_store_kind() == "rdb":
            session_id = await get_latest_session_id()
            if session_id is None:
                logger.debug("No sessions found for current user")
                return None
            logger.debug("Found latest session for current user: {session_id}", session_id=session_id)
            return await Session.find(work_dir, session_id)

        metadata = await load_metadata()
        work_dir_meta = metadata.get_work_dir_meta(work_dir)
        if work_dir_meta is None:
            logger.debug("Work directory never been used")
            return None
        if work_dir_meta.last_session_id is None:
            logger.debug("Work directory never had a session")
            return None

        logger.debug(
            "Found last session for work directory: {session_id}",
            session_id=work_dir_meta.last_session_id,
        )
        return await Session.find(work_dir, work_dir_meta.last_session_id)

    async def mark_as_last_session(self, metadata=None) -> None:
        """Persist this session as the latest session for the work directory."""

        if get_store_kind() == "rdb":
            return
        if metadata is None:
            metadata = await load_metadata()
        metadata.mark_last_session(self.work_dir, self.id)
        await save_metadata(metadata)

    async def save_state(self) -> None:
        """Persist the session state through the configured store backend."""

        store = get_session_store()
        await store.save_session_state(self.work_dir_meta, self.id, self.state)

    async def finalize_run(self) -> None:
        """Update metadata after one successful service/CLI run."""

        # RDB sessions may persist state without any context/wire records yet.
        if get_store_kind() == "rdb":
            return

        if await self.is_empty():
            await self.delete()
            metadata = await load_metadata()
            work_dir_meta = metadata.get_or_create_work_dir_meta(self.work_dir)
            if work_dir_meta.last_session_id == self.id:
                metadata.mark_last_session(self.work_dir, None)
                await save_metadata(metadata)
            return
        metadata = await load_metadata()
        metadata.mark_last_session(self.work_dir, self.id)
        await save_metadata(metadata)

    async def _clear_last_session_marker_if_needed(self) -> None:
        metadata = await load_metadata()
        work_dir_meta = metadata.get_work_dir_meta(self.work_dir)
        if work_dir_meta is None:
            return
        if work_dir_meta.last_session_id != self.id:
            return
        metadata.mark_last_session(self.work_dir, None)
        await save_metadata(metadata)


def _resolve_rdb_work_dir_base() -> Path:
    base = os.getenv("KIMI_RDB_WORK_DIR_BASE")
    value = base.strip() if base else ""
    if not value:
        value = "/app/workdir/learyai"
    return Path(value).expanduser().resolve()


def _resolve_rdb_work_dir_for_session(session_id: str) -> KaosPath:
    path = _resolve_rdb_work_dir_base() / session_id
    path.mkdir(parents=True, exist_ok=True)
    return KaosPath.unsafe_from_local_path(path)


def _rdb_work_dir_meta() -> WorkDirMeta:
    # RDB 模式下会话索引由 sessions 表维护，这里只保留本地占位目录语义。
    return WorkDirMeta(path="rdb")


def _migrate_session_context_file(work_dir_meta: WorkDirMeta, session_id: str) -> None:
    store = get_session_store()
    before_exists = (work_dir_meta.sessions_dir / f"{session_id}.jsonl").exists()
    store.migrate_context_file(work_dir_meta, session_id)
    if before_exists and (work_dir_meta.sessions_dir / session_id / "context.jsonl").exists():
        logger.info(
            "Migrated session context file from {old} to {new}",
            old=work_dir_meta.sessions_dir / f"{session_id}.jsonl",
            new=work_dir_meta.sessions_dir / session_id / "context.jsonl",
        )
