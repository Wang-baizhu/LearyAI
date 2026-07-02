# Responsibilities: store backend selector and unified store entry points.
from __future__ import annotations

import os

StoreKind = str

__all__ = [
    "get_context_store",
    "get_metadata_store",
    "get_session_store",
    "get_subagent_store",
    "get_wire_store",
    "get_store_kind",
    "StoreKind",
]


def _store_kind_from_env() -> StoreKind:
    raw = os.getenv("LEARY_STORE", "rdb")
    if raw is None:
        return "rdb"
    value = raw.strip().lower()
    if not value:
        return "rdb"
    if value not in {"file", "rdb", "none"}:
        raise ValueError(
            "Unsupported LEARY_STORE value: {value}. Expected 'file', 'rdb', or 'none'.".format(
                value=value
            )
        )
    return value


def get_store_kind() -> StoreKind:
    return _store_kind_from_env()


def get_metadata_store():
    kind = _store_kind_from_env()
    if kind == "none":
        from kimi_cli.store.none.metadata_store import get_metadata_store as _get

        return _get()
    if kind == "file":
        from kimi_cli.store.file.metadata_store import get_metadata_store as _get

        return _get()
    from kimi_cli.store.rdb.metadata_store import get_metadata_store as _get

    return _get()


def get_context_store():
    kind = _store_kind_from_env()
    if kind == "none":
        from kimi_cli.store.none.context_store import get_context_store as _get

        return _get()
    if kind == "file":
        from kimi_cli.store.file.context_store import get_context_store as _get

        return _get()
    from kimi_cli.store.rdb.context_store import get_context_store as _get

    return _get()


def get_session_store():
    kind = _store_kind_from_env()
    if kind == "none":
        from kimi_cli.store.none.session_store import get_session_store as _get

        return _get()
    if kind == "file":
        from kimi_cli.store.file.session_store import get_session_store as _get

        return _get()
    from kimi_cli.store.rdb.session_store import get_session_store as _get

    return _get()


def get_subagent_store(session):
    from kimi_cli.store.subagent_store import get_subagent_store as _get

    return _get(session)


def get_wire_store():
    kind = _store_kind_from_env()
    if kind == "none":
        from kimi_cli.store.none.wire_store import get_wire_store as _get

        return _get()
    if kind == "file":
        from kimi_cli.store.file.wire_store import get_wire_store as _get

        return _get()
    from kimi_cli.store.rdb.wire_store import get_wire_store as _get

    return _get()
