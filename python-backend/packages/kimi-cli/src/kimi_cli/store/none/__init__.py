# Responsibilities: expose noop store implementations for non-persistent mode.
from __future__ import annotations

__all__ = [
    "get_context_store",
    "get_metadata_store",
    "get_session_store",
    "get_wire_store",
]

from kimi_cli.store.none.context_store import get_context_store
from kimi_cli.store.none.metadata_store import get_metadata_store
from kimi_cli.store.none.session_store import get_session_store
from kimi_cli.store.none.wire_store import get_wire_store
