# 该文件职责：提供对象存储（Minio/OSS）的下载与上传能力。

from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Iterable, Protocol
from urllib.parse import urlparse


class _StorageAdapter(Protocol):
    def download_to_file(self, object_key: str, file_path: Path) -> None:
        ...

    def upload_file(self, object_name: str, file_path: Path) -> None:
        ...

    def delete_prefix(self, prefix: str) -> None:
        ...


def _resolve_provider() -> str:
    provider = (os.getenv("KB_STORAGE_PROVIDER") or "").strip().lower()
    if provider in {"oss", "minio"}:
        return provider
    if os.getenv("KB_STORAGE_OSS_ACCESS_KEY_ID"):
        return "oss"
    return "minio"


def _minio_storage_config() -> dict[str, str]:
    return {
        "endpoint": os.getenv("KB_STORAGE_MINIO_ENDPOINT", "http://localhost:9000"),
        "bucket": os.getenv("KB_STORAGE_MINIO_BUCKET", "learyai"),
        "access_key": os.getenv("KB_STORAGE_MINIO_ACCESS_KEY", "minioadmin"),
        "secret_key": os.getenv("KB_STORAGE_MINIO_SECRET_KEY", "minioadmin"),
    }


def _oss_storage_config() -> dict[str, str]:
    return {
        "endpoint": os.getenv(
            "KB_STORAGE_OSS_ENDPOINT",
            os.getenv("KB_STORAGE_MINIO_ENDPOINT", "https://oss-cn-hangzhou.aliyuncs.com"),
        ),
        "bucket": os.getenv("KB_STORAGE_OSS_BUCKET", os.getenv("KB_STORAGE_MINIO_BUCKET", "learyai")),
        "access_key_id": os.getenv(
            "KB_STORAGE_OSS_ACCESS_KEY_ID",
            os.getenv("KB_STORAGE_MINIO_ACCESS_KEY", ""),
        ),
        "access_key_secret": os.getenv(
            "KB_STORAGE_OSS_ACCESS_KEY_SECRET",
            os.getenv("KB_STORAGE_MINIO_SECRET_KEY", ""),
        ),
    }


def _parse_endpoint(endpoint: str) -> tuple[str, bool, str]:
    parsed = urlparse(endpoint)
    if parsed.scheme and parsed.netloc:
        host = parsed.netloc
        secure = parsed.scheme == "https"
        normalized = f"{parsed.scheme}://{parsed.netloc}"
    else:
        host = parsed.path
        secure = False
        normalized = f"http://{host.strip('/')}"
    host = host.strip("/")
    return host, secure, normalized


def _minio_client() -> object:
    config = _minio_storage_config()
    host, secure, _ = _parse_endpoint(config["endpoint"])
    try:
        from minio import Minio
    except ModuleNotFoundError as exc:
        raise ModuleNotFoundError("minio dependency is required for KB_STORAGE_PROVIDER=minio") from exc
    return Minio(
        endpoint=host,
        access_key=config["access_key"],
        secret_key=config["secret_key"],
        secure=secure,
    )


class _MinioStorageAdapter:
    def __init__(self) -> None:
        self._config = _minio_storage_config()
        self._client = _minio_client()

    def download_to_file(self, object_key: str, file_path: Path) -> None:
        object_name = object_key.lstrip("/")
        with self._client.get_object(self._config["bucket"], object_name) as resp, open(file_path, "wb") as dest:
            for chunk in resp.stream(32 * 1024):
                dest.write(chunk)

    def upload_file(self, object_name: str, file_path: Path) -> None:
        with open(file_path, "rb") as f:
            self._client.put_object(
                self._config["bucket"],
                object_name,
                f,
                length=file_path.stat().st_size,
                content_type="image/jpeg",
            )

    def delete_prefix(self, prefix: str) -> None:
        normalized_prefix = prefix.strip().lstrip("/")
        if not normalized_prefix:
            return
        for obj in self._client.list_objects(
            self._config["bucket"],
            prefix=normalized_prefix,
            recursive=True,
        ):
            self._client.remove_object(self._config["bucket"], obj.object_name)


class _OssStorageAdapter:
    def __init__(self) -> None:
        self._config = _oss_storage_config()
        _, _, endpoint = _parse_endpoint(self._config["endpoint"])
        access_key_id = self._config["access_key_id"]
        access_key_secret = self._config["access_key_secret"]
        if not access_key_id or not access_key_secret:
            raise ValueError("OSS access key config is missing")
        try:
            import oss2
        except ModuleNotFoundError as exc:
            raise ModuleNotFoundError("oss2 dependency is required for KB_STORAGE_PROVIDER=oss") from exc
        auth = oss2.Auth(access_key_id, access_key_secret)
        self._bucket = oss2.Bucket(auth, endpoint, self._config["bucket"])

    def download_to_file(self, object_key: str, file_path: Path) -> None:
        object_name = object_key.lstrip("/")
        result = self._bucket.get_object(object_name)
        with open(file_path, "wb") as dest:
            for chunk in result:
                dest.write(chunk)

    def upload_file(self, object_name: str, file_path: Path) -> None:
        self._bucket.put_object_from_file(
            object_name,
            str(file_path),
            headers={"Content-Type": "image/jpeg"},
        )

    def delete_prefix(self, prefix: str) -> None:
        normalized_prefix = prefix.strip().lstrip("/")
        if not normalized_prefix:
            return
        marker = ""
        while True:
            result = self._bucket.list_objects(prefix=normalized_prefix, marker=marker)
            object_keys = [obj.key for obj in result.object_list]
            if object_keys:
                self._bucket.batch_delete_objects(object_keys)
            if not result.is_truncated:
                return
            marker = result.next_marker


def _storage_adapter() -> _StorageAdapter:
    provider = _resolve_provider()
    if provider == "oss":
        return _OssStorageAdapter()
    return _MinioStorageAdapter()


def download_to_temp(object_key: str, suffix: str) -> Path:
    tmp_dir = Path(tempfile.mkdtemp(prefix="kb_doc_"))
    tmp_path = tmp_dir / f"doc{suffix}"
    adapter = _storage_adapter()
    adapter.download_to_file(object_key, tmp_path)
    return tmp_path


def _object_prefix(object_key: str) -> str:
    raw = object_key.lstrip("/")
    if "/" not in raw:
        return ""
    prefix = raw.rsplit("/", 1)[0].strip("/")
    return f"{prefix}/" if prefix else ""


def upload_images(image_paths: Iterable[Path], object_key: str) -> None:
    adapter = _storage_adapter()
    prefix = _object_prefix(object_key)
    for path in image_paths:
        object_name = f"{prefix}{path.name}"
        adapter.upload_file(object_name, path)


def delete_images_by_prefix(object_key: str) -> None:
    adapter = _storage_adapter()
    prefix = _object_prefix(object_key)
    if not prefix:
        return
    adapter.delete_prefix(prefix)
