# Responsibilities: define metadata models and delegate metadata IO to store.
from __future__ import annotations

from hashlib import md5
from pathlib import Path

from kaos import get_current_kaos
from kaos.local import local_kaos
from kaos.path import KaosPath
from pydantic import BaseModel, ConfigDict, Field

from kimi_cli.share import get_share_dir
from kimi_cli.store import get_metadata_store, get_store_kind
from kimi_cli.utils.logging import logger


def get_metadata_file() -> Path:
    return get_share_dir() / "kimi.json"


class WorkDirMeta(BaseModel):
    """Metadata for a work directory."""

    path: str
    """The full path of the work directory."""

    kaos: str = local_kaos.name
    """The name of the KAOS where the work directory is located."""

    last_session_id: str | None = None
    """Last session ID of this work directory."""

    @property
    def sessions_dir(self) -> Path:
        """The directory to store sessions for this work directory."""
        path_md5 = md5(self.path.encode(encoding="utf-8")).hexdigest()
        dir_basename = path_md5 if self.kaos == local_kaos.name else f"{self.kaos}_{path_md5}"
        session_dir = get_share_dir() / "sessions" / dir_basename
        if get_store_kind() != "rdb":
            session_dir.mkdir(parents=True, exist_ok=True)
        return session_dir


class Metadata(BaseModel):
    """Kimi metadata structure."""

    model_config = ConfigDict(extra="ignore")

    work_dirs: list[WorkDirMeta] = Field(default_factory=list[WorkDirMeta])
    """Work directory list."""

    def _resolve_work_dir_key(self, path: KaosPath) -> str:
        if get_store_kind() == "rdb":
            return "rdb"
        return str(path)

    def get_work_dir_meta(self, path: KaosPath) -> WorkDirMeta | None:
        """Get the metadata for a work directory."""
        key = self._resolve_work_dir_key(path)
        for wd in self.work_dirs:
            if wd.path == key and wd.kaos == get_current_kaos().name:
                return wd
        return None

    def new_work_dir_meta(self, path: KaosPath) -> WorkDirMeta:
        """Create a new work directory metadata."""
        key = self._resolve_work_dir_key(path)
        wd_meta = WorkDirMeta(path=key, kaos=get_current_kaos().name)
        self.work_dirs.append(wd_meta)
        return wd_meta

    def get_or_create_work_dir_meta(self, path: KaosPath) -> WorkDirMeta:
        """Return existing work-dir metadata or create it on demand."""

        work_dir_meta = self.get_work_dir_meta(path)
        if work_dir_meta is not None:
            return work_dir_meta
        return self.new_work_dir_meta(path)

    def mark_last_session(self, path: KaosPath, session_id: str | None) -> WorkDirMeta:
        """Update the last session pointer for one work directory."""

        work_dir_meta = self.get_or_create_work_dir_meta(path)
        work_dir_meta.last_session_id = session_id
        return work_dir_meta


async def load_metadata() -> Metadata:
    store = get_metadata_store()
    metadata_backend = store.metadata_file()
    logger.debug("Loading metadata via store backend: {backend}", backend=metadata_backend)
    data = await store.load()
    if not data:
        logger.debug("No metadata found in store backend, creating empty metadata")
        return Metadata()
    return Metadata(**data)


async def save_metadata(metadata: Metadata):
    store = get_metadata_store()
    metadata_backend = store.metadata_file()
    logger.debug("Saving metadata via store backend: {backend}", backend=metadata_backend)
    await store.save(metadata.model_dump())
