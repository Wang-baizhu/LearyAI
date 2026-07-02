# Responsibilities: run tasks_server async workloads on a shared event loop for concurrency-safe resource reuse.

from __future__ import annotations

import asyncio
import threading
from collections.abc import Coroutine
from typing import Any, TypeVar

from kimi_cli.store.rdb.runtime import close_pool
from usage_control.outbox import start_usage_delivery_runtime, stop_usage_delivery_runtime

T = TypeVar("T")


class SharedAsyncRunner:
    def __init__(self) -> None:
        self._loop: asyncio.AbstractEventLoop | None = None
        self._thread: threading.Thread | None = None
        self._lock = threading.Lock()
        self._ready = threading.Event()
        self._startup_error: BaseException | None = None

    def start(self) -> None:
        with self._lock:
            if self._thread is not None and self._thread.is_alive():
                return
            self._ready.clear()
            self._startup_error = None
            thread = threading.Thread(
                target=self._run_loop,
                name="tasks-server-async-runner",
                daemon=True,
            )
            self._thread = thread
            thread.start()
        self._ready.wait()
        if self._startup_error is not None:
            raise RuntimeError("shared async runner failed to start") from self._startup_error
        self.run(start_usage_delivery_runtime())

    def run(self, coro: Coroutine[Any, Any, T]) -> T:
        self.start()
        loop = self._loop
        if loop is None:
            raise RuntimeError("shared async runner loop not ready")
        future = asyncio.run_coroutine_threadsafe(coro, loop)
        return future.result()

    def stop(self) -> None:
        with self._lock:
            loop = self._loop
            thread = self._thread
            if loop is None or thread is None:
                return
            self._loop = None
            self._thread = None
        try:
            cleanup = asyncio.run_coroutine_threadsafe(self._shutdown_async_resources(), loop)
            cleanup.result(timeout=10)
        except Exception:
            pass
        loop.call_soon_threadsafe(loop.stop)
        thread.join(timeout=10)
        if loop.is_running():
            return
        loop.close()

    def _run_loop(self) -> None:
        loop = asyncio.new_event_loop()
        try:
            asyncio.set_event_loop(loop)
            self._loop = loop
        except BaseException as exc:
            self._startup_error = exc
            self._ready.set()
            loop.close()
            raise
        self._ready.set()
        try:
            loop.run_forever()
        finally:
            pending = asyncio.all_tasks(loop)
            for task in pending:
                task.cancel()
            if pending:
                try:
                    loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))
                except Exception:
                    pass

    async def _shutdown_async_resources(self) -> None:
        await stop_usage_delivery_runtime()
        await close_pool()
