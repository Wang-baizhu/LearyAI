# Responsibilities: abstract metadata IO for loading and saving metadata JSON.
from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Protocol

from kimi_cli.share import get_share_dir


class MetadataStore(Protocol):
    def metadata_file(self) -> Path:
        raise NotImplementedError

    async def load(self) -> dict:
        raise NotImplementedError

    async def save(self, data: dict) -> None:
        raise NotImplementedError


class FileMetadataStore:
    def metadata_file(self) -> Path:
        return get_share_dir() / "kimi.json"

    async def load(self) -> dict:
        metadata_file = self.metadata_file()
        if not await asyncio.to_thread(metadata_file.exists):
            return {}

        def _load() -> dict:
            with open(metadata_file, encoding="utf-8") as f:
                return json.load(f)

        return await asyncio.to_thread(_load)

    async def save(self, data: dict) -> None:
        metadata_file = self.metadata_file()
        await asyncio.to_thread(metadata_file.parent.mkdir, parents=True, exist_ok=True)

        def _save() -> None:
            with open(metadata_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)

        await asyncio.to_thread(_save)


_metadata_store: MetadataStore = FileMetadataStore()


def get_metadata_store() -> MetadataStore:
    return _metadata_store


def set_metadata_store(store: MetadataStore) -> None:
    global _metadata_store
    _metadata_store = store
