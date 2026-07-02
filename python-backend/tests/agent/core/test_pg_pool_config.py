# 该文件职责：验证 RDB asyncpg 连接池参数按环境变量解析并传递给 create_pool。

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from kimi_cli.store.rdb.pg import PgConfig, PgPool


def test_pg_config_reads_pool_settings_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    # 测试内容：显式配置 KIMI_PG_POOL_* 时，应解析为连接池大小参数。
    monkeypatch.setenv("LEARY_PG_DSN", "postgresql://user:pw@db:5432/app")
    monkeypatch.setenv("KIMI_PG_POOL_MIN_SIZE", "3")
    monkeypatch.setenv("KIMI_PG_POOL_MAX_SIZE", "18")

    config = PgConfig.from_env()

    assert config.pool_min_size == 3
    assert config.pool_max_size == 18


def test_pg_config_rejects_min_size_greater_than_max_size(monkeypatch: pytest.MonkeyPatch) -> None:
    # 测试内容：连接池最小值大于最大值时，应直接报错暴露配置问题。
    monkeypatch.setenv("LEARY_PG_DSN", "postgresql://user:pw@db:5432/app")
    monkeypatch.setenv("KIMI_PG_POOL_MIN_SIZE", "5")
    monkeypatch.setenv("KIMI_PG_POOL_MAX_SIZE", "4")

    with pytest.raises(ValueError, match="KIMI_PG_POOL_MIN_SIZE cannot be greater than KIMI_PG_POOL_MAX_SIZE"):
        PgConfig.from_env()


@pytest.mark.asyncio
async def test_pg_pool_connect_passes_pool_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    # 测试内容：建立 asyncpg 连接池时，应把解析出的 min/max size 透传给 asyncpg.create_pool。
    monkeypatch.setenv("LEARY_PG_DSN", "postgresql://user:pw@db:5432/app")
    monkeypatch.setenv("KIMI_PG_POOL_MIN_SIZE", "4")
    monkeypatch.setenv("KIMI_PG_POOL_MAX_SIZE", "12")
    create_pool = AsyncMock()
    with patch("kimi_cli.store.rdb.pg.asyncpg.create_pool", create_pool):
        pool = PgPool(PgConfig.from_env())
        await pool.connect()

    create_pool.assert_awaited_once()
    kwargs = create_pool.await_args.kwargs
    assert kwargs["min_size"] == 4
    assert kwargs["max_size"] == 12
