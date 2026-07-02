# Responsibilities: noop metadata store that does not persist data.
from __future__ import annotations

from pathlib import Path
from typing import Protocol


class MetadataStore(Protocol):
    def metadata_file(self) -> Path:
        raise NotImplementedError

    async def load(self) -> dict:
        raise NotImplementedError

    async def save(self, data: dict) -> None:
        raise NotImplementedError


class NoneMetadataStore:
    def metadata_file(self) -> Path:
        return Path(".none-metadata.json")

    async def load(self) -> dict:
        return {}

    async def save(self, data: dict) -> None:
        _ = data
        return None


_metadata_store: MetadataStore = NoneMetadataStore()


def get_metadata_store() -> MetadataStore:
    return _metadata_store
