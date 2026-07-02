# Responsibilities: explicit store target descriptor for file/rdb backends.
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Literal


@dataclass(frozen=True, slots=True, kw_only=True)
class StoreTarget:
    kind: Literal["session", "subagent"]
    session_id: str
    path: Path

