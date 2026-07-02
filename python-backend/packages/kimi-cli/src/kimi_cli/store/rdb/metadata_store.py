# Responsibilities: RDB-backed metadata store implementation.
from __future__ import annotations

import json
from pathlib import Path

from kimi_cli.share import get_share_dir
from kimi_cli.store.file.metadata_store import MetadataStore
from kimi_cli.store.rdb.runtime import acquire_conn, ensure_schema, get_user_id


class RdbMetadataStore(MetadataStore):
    def metadata_file(self) -> Path:
        return get_share_dir() / "learyai.json"

    async def load(self) -> dict:
        await ensure_schema()
        async with acquire_conn() as conn:
            row = await conn.fetchrow(
                "SELECT data FROM learyai_metadata WHERE user_id=$1 AND id=1",
                get_user_id(),
            )
        if row is None:
            return {}
        data = row["data"]
        if isinstance(data, str):
            return json.loads(data)
        return dict(data)

    async def save(self, data: dict) -> None:
        await ensure_schema()
        async with acquire_conn() as conn:
            await conn.execute(
                """
                INSERT INTO learyai_metadata (user_id, id, data, updated_at)
                VALUES ($1, 1, $2::jsonb, NOW())
                ON CONFLICT (user_id, id)
                DO UPDATE SET data=EXCLUDED.data, updated_at=NOW()
                """,
                get_user_id(),
                json.dumps(data, ensure_ascii=False),
            )


_metadata_store: MetadataStore = RdbMetadataStore()


def get_metadata_store() -> MetadataStore:
    return _metadata_store


def set_metadata_store(store: MetadataStore) -> None:
    global _metadata_store
    _metadata_store = store
