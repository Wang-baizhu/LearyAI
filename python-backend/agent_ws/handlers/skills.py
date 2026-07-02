# 该文件职责：处理技能相关命令（load/install/uninstall）。

from __future__ import annotations

from typing import Any

from agent_ws.schemas.context import ConnectionContext
from agent_ws.handlers import logger


async def load(
    payload: dict[str, Any],
    meta: dict[str, Any],
    context: ConnectionContext,
) -> list[dict[str, Any]]:
    logger.debug("skills.load requested user=%s", context.user_id)
    return [
        {
            "event": "skills:loaded",
            "payload": {"status": "not_implemented"},
            "meta": {"userId": context.user_id},
        }
    ]


async def install(
    payload: dict[str, Any],
    meta: dict[str, Any],
    context: ConnectionContext,
) -> list[dict[str, Any]]:
    logger.debug("skills.install requested user=%s", context.user_id)
    return [
        {
            "event": "skills:installed",
            "payload": {"status": "not_implemented"},
            "meta": {"userId": context.user_id},
        }
    ]


async def uninstall(
    payload: dict[str, Any],
    meta: dict[str, Any],
    context: ConnectionContext,
) -> list[dict[str, Any]]:
    logger.debug("skills.uninstall requested user=%s", context.user_id)
    return [
        {
            "event": "skills:uninstalled",
            "payload": {"status": "not_implemented"},
            "meta": {"userId": context.user_id},
        }
    ]
