# Responsibilities: initialize logging for tasks_server with shared logging package.

from __future__ import annotations

from leary_logging import setup_logging as setup_shared_logging


def setup_logging() -> None:
    setup_shared_logging(component="tasks_server")
