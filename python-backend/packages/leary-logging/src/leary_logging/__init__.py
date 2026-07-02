# 该文件职责：提供 python-backend 统一日志初始化与组件化 logger。
from __future__ import annotations

import codecs
import contextlib
import locale
import logging
import os
import sys
import threading
from collections.abc import Iterator
from pathlib import Path
from typing import IO

from loguru import logger

_TRUE_VALUES = frozenset({"1", "true", "yes", "on"})
_TEXT_LOG_FORMAT = (
    "{time:YYYY-MM-DD HH:mm:ss.SSS} | {level} | {extra[component]} | "
    "{name}:{line} - {message}"
)
_LOGGING_INITIALIZED = False
_LOGGING_LOCK = threading.Lock()


def _ensure_component(record: dict) -> None:
    extra = record.setdefault("extra", {})
    component = extra.get("component")
    if isinstance(component, str) and component:
        return
    name = record.get("name")
    if isinstance(name, str) and name:
        extra["component"] = name.split(".", 1)[0]
        return
    extra["component"] = "python"


def _is_truthy(value: str | None) -> bool:
    if value is None:
        return False
    return value.strip().lower() in _TRUE_VALUES


def _resolve_level(explicit_level: str | None) -> str:
    raw = explicit_level or os.getenv("LOG_LEVEL", "INFO")
    return raw.strip().upper() or "INFO"


def _resolve_format(explicit_format: str | None) -> str:
    raw = explicit_format or os.getenv("LOG_FORMAT", "text")
    normalized = raw.strip().lower()
    if normalized not in {"text", "json"}:
        return "text"
    return normalized


def _resolve_log_file(component: str, explicit_file: str | None) -> str | None:
    if explicit_file is not None:
        trimmed = explicit_file.strip()
        return trimmed or None
    env_file = os.getenv("LOG_FILE", "").strip()
    if env_file:
        return env_file
    log_dir = os.getenv("LOG_DIR", "").strip()
    if not log_dir:
        return None
    return str(Path(log_dir) / f"{component}.log")


class _InterceptHandler(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        try:
            level_name: str | int = logger.level(record.levelname).name
        except ValueError:
            level_name = record.levelno
        component = record.__dict__.get("component")
        if not isinstance(component, str) or not component:
            component = record.name.split(".", 1)[0] if record.name else "python"
        logger.bind(component=component).opt(
            depth=6,
            exception=record.exc_info,
        ).log(level_name, record.getMessage())


class StderrRedirector:
    def __init__(self, level: str = "ERROR") -> None:
        self._level = level
        self._encoding: str | None = None
        self._installed = False
        self._lock = threading.Lock()
        self._original_fd: int | None = None
        self._read_fd: int | None = None
        self._thread: threading.Thread | None = None

    def install(self) -> None:
        with self._lock:
            if self._installed:
                return
            with contextlib.suppress(Exception):
                sys.stderr.flush()
            if self._original_fd is None:
                with contextlib.suppress(OSError):
                    self._original_fd = os.dup(2)
            if self._encoding is None:
                self._encoding = (
                    sys.stderr.encoding or locale.getpreferredencoding(False) or "utf-8"
                )
            read_fd, write_fd = os.pipe()
            os.dup2(write_fd, 2)
            os.close(write_fd)
            self._read_fd = read_fd
            self._thread = threading.Thread(
                target=self._drain, name="leary-stderr-redirect", daemon=True
            )
            self._thread.start()
            self._installed = True

    def _drain(self) -> None:
        buffer = ""
        read_fd = self._read_fd
        if read_fd is None:
            return
        encoding = self._encoding or "utf-8"
        decoder = codecs.getincrementaldecoder(encoding)(errors="replace")
        try:
            while True:
                chunk = os.read(read_fd, 4096)
                if not chunk:
                    break
                buffer += decoder.decode(chunk)
                while "\n" in buffer:
                    line, buffer = buffer.split("\n", 1)
                    self._log_line(line)
        except Exception:
            logger.bind(component="stderr").exception("Failed to read redirected stderr")
        finally:
            buffer += decoder.decode(b"", final=True)
            if buffer:
                self._log_line(buffer)
            with contextlib.suppress(OSError):
                os.close(read_fd)

    def _log_line(self, line: str) -> None:
        text = line.rstrip("\r")
        if not text:
            return
        logger.bind(component="stderr").opt(depth=2).log(self._level, text)

    def open_original_stderr_handle(self) -> IO[bytes] | None:
        if self._original_fd is None:
            return None
        dup_fd = os.dup(self._original_fd)
        os.set_inheritable(dup_fd, True)
        return os.fdopen(dup_fd, "wb", closefd=True)


_stderr_redirector: StderrRedirector | None = None


def redirect_stderr_to_logger(level: str = "ERROR") -> None:
    global _stderr_redirector
    if _stderr_redirector is None:
        _stderr_redirector = StderrRedirector(level=level)
    _stderr_redirector.install()


@contextlib.contextmanager
def open_original_stderr() -> Iterator[IO[bytes] | None]:
    redirector = _stderr_redirector
    if redirector is None:
        yield None
        return
    stream = redirector.open_original_stderr_handle()
    try:
        yield stream
    finally:
        if stream is not None:
            stream.close()


def _configure_standard_logging(level: str) -> None:
    level_no = logging.getLevelName(level)
    if not isinstance(level_no, int):
        level_no = logging.INFO
    handler = _InterceptHandler()
    root_logger = logging.getLogger()
    root_logger.handlers = [handler]
    root_logger.setLevel(level_no)
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access", "fastapi"):
        current = logging.getLogger(name)
        current.handlers = [handler]
        current.propagate = False
        current.setLevel(level_no)
    for name in ("httpx", "httpcore", "openai", "pika"):
        logging.getLogger(name).setLevel(logging.WARNING)


def get_logger(component: str):
    return logger.bind(component=component)


def setup_logging(
    component: str,
    *,
    level: str | None = None,
    log_format: str | None = None,
    to_stdout: bool | None = None,
    log_file: str | None = None,
    enable_stderr_redirect: bool = True,
):
    global _LOGGING_INITIALIZED
    with _LOGGING_LOCK:
        if not _LOGGING_INITIALIZED:
            resolved_level = _resolve_level(level)
            resolved_format = _resolve_format(log_format)
            resolved_to_stdout = (
                to_stdout
                if to_stdout is not None
                else _is_truthy(os.getenv("LOG_TO_STDOUT", "1"))
            )
            resolved_log_file = _resolve_log_file(component, log_file)
            serialize = resolved_format == "json"

            logger.remove()
            logger.configure(patcher=_ensure_component)
            if resolved_to_stdout:
                stdout_add_kwargs = {
                    "level": resolved_level,
                    "serialize": serialize,
                    "backtrace": False,
                    "diagnose": False,
                }
                if not serialize:
                    stdout_add_kwargs["format"] = _TEXT_LOG_FORMAT
                logger.add(sys.stdout, **stdout_add_kwargs)
            if resolved_log_file:
                log_path = Path(resolved_log_file)
                log_path.parent.mkdir(parents=True, exist_ok=True)
                file_add_kwargs = {
                    "level": resolved_level,
                    "serialize": serialize,
                    "rotation": "06:00",
                    "retention": "10 days",
                    "backtrace": False,
                    "diagnose": False,
                }
                if not serialize:
                    file_add_kwargs["format"] = _TEXT_LOG_FORMAT
                logger.add(log_path, **file_add_kwargs)

            logger.enable("agent_ws")
            logger.enable("kimi_cli")
            logger.enable("tasks_server")
            logger.enable("kb_server")
            logger.enable("kosong")

            _configure_standard_logging(resolved_level)
            if enable_stderr_redirect:
                redirect_stderr_to_logger(level=resolved_level)
            _LOGGING_INITIALIZED = True
    return get_logger(component)


__all__ = [
    "StderrRedirector",
    "get_logger",
    "logger",
    "open_original_stderr",
    "redirect_stderr_to_logger",
    "setup_logging",
]
