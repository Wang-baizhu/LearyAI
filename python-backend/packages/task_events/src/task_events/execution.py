# 该文件职责：复用任务执行去重、租约续约与完成收尾的公共执行协调逻辑。

from __future__ import annotations

import logging
import threading
from typing import Any, Callable, Protocol, TypeVar

from .domain.models import TaskExecutionRunResult


class _TaskExecutionRuntime(Protocol):
    def begin_task_execution(
        self,
        *,
        task_key: str,
        owner_id: str,
        lease_seconds: int,
    ) -> Any: ...

    def renew_task_execution(
        self,
        *,
        task_key: str,
        owner_id: str,
        lease_seconds: int,
    ) -> bool: ...

    def fail_task_execution(
        self,
        *,
        task_key: str,
        owner_id: str,
    ) -> None: ...


T = TypeVar("T")


class TaskExecutionLeaseRenewer:
    def __init__(
        self,
        runtime: _TaskExecutionRuntime,
        *,
        task_key: str,
        owner_id: str,
        lease_seconds: int,
        logger: logging.Logger,
        log_prefix: str = "task execution",
    ) -> None:
        self._runtime = runtime
        self._task_key = task_key
        self._owner_id = owner_id
        self._lease_seconds = lease_seconds
        self._logger = logger
        self._log_prefix = log_prefix
        self._stop_event = threading.Event()
        self._thread = threading.Thread(
            target=self._run,
            name=f"{log_prefix.replace(' ', '-')}-lease-renewer-{task_key}",
            daemon=True,
        )
        self._error: Exception | None = None

    def start(self) -> None:
        self._thread.start()

    def _run(self) -> None:
        interval_seconds = max(5.0, self._lease_seconds / 3)
        while not self._stop_event.wait(interval_seconds):
            try:
                renewed = self._runtime.renew_task_execution(
                    task_key=self._task_key,
                    owner_id=self._owner_id,
                    lease_seconds=self._lease_seconds,
                )
            except Exception as exc:
                self._error = RuntimeError(
                    f"{self._log_prefix} lease renew failed task_key={self._task_key}"
                )
                self._logger.error(
                    "%s lease renew errored taskKey=%s ownerId=%s error=%s",
                    self._log_prefix,
                    self._task_key,
                    self._owner_id,
                    exc,
                )
                return
            if renewed:
                continue
            self._error = RuntimeError(
                f"{self._log_prefix} lease lost task_key={self._task_key}"
            )
            self._logger.error(
                "%s lease lost taskKey=%s ownerId=%s",
                self._log_prefix,
                self._task_key,
                self._owner_id,
            )
            return

    def stop(self) -> None:
        self._stop_event.set()
        self._thread.join(timeout=2.0)

    def raise_if_failed(self) -> None:
        if self._error is not None:
            raise self._error


def run_task_with_execution_lease(
    *,
    runtime: _TaskExecutionRuntime,
    task_key: str,
    owner_id: str,
    lease_seconds: int,
    renewer_factory: Callable[[], Any],
    on_started: Callable[[], None] | None = None,
    on_run: Callable[[], T],
    on_complete: Callable[[T], str],
) -> TaskExecutionRunResult:
    claim = runtime.begin_task_execution(
        task_key=task_key,
        owner_id=owner_id,
        lease_seconds=lease_seconds,
    )
    if claim.decision != "started":
        return TaskExecutionRunResult(
            decision=claim.decision,
            completed_event_key=getattr(claim, "completed_event_key", None),
        )

    if on_started is not None:
        on_started()

    renewer = renewer_factory()
    renewer.start()
    try:
        completion = on_run()
        renewer.raise_if_failed()
        completed_event_key = on_complete(completion)
        return TaskExecutionRunResult(
            decision="started",
            completed_event_key=completed_event_key,
            run_output=completion,
        )
    except Exception:
        runtime.fail_task_execution(task_key=task_key, owner_id=owner_id)
        raise
    finally:
        renewer.stop()
