# Responsibilities: wrap kimi_cli session creation and loading.

from __future__ import annotations

import os

from kaos.path import KaosPath

from kimi_cli.session import Session


def _resolve_cwd(cwd: str | None) -> str:
    if cwd:
        return cwd
    return os.getenv("KIMI_TASK_CWD", os.getcwd())


async def get_or_create_session(session_id: str | None, *, cwd: str | None) -> Session:
    cwd_value = _resolve_cwd(cwd)
    work_dir = KaosPath.unsafe_from_local_path(cwd_value)
    if session_id:
        session = await Session.find(work_dir, session_id)
        if session is not None:
            return session
    return await Session.create(work_dir, session_id)
