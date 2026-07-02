# 该文件职责：验证 query 级 PG 观测聚合的计数、排序与摘要输出。

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from kimi_cli.store.rdb.runtime import (
    begin_query_pg_observation,
    finish_query_pg_observation,
    format_query_pg_observation,
    is_context_target_verified,
    is_wire_target_verified,
    log_pg_timing,
    mark_context_target_verified,
    mark_wire_target_verified,
    touch_session_updated_at,
    update_query_pg_observation,
)


def test_query_pg_observation_aggregates_operation_counts() -> None:
    # 测试内容：在同一次 query 观测窗口内，重复 PG operation 应正确聚合次数、总耗时与最大耗时。
    token = begin_query_pg_observation("trace-1", user_id="user-a", session_id=None)
    update_query_pg_observation(session_id="session-1")

    log_pg_timing("context.append_messages.insert", 3.5)
    log_pg_timing("context.append_messages.insert", 7.0)
    log_pg_timing("acquire_conn", 2.0)

    summary = finish_query_pg_observation(token)

    assert summary is not None
    assert summary.query_id == "trace-1"
    assert summary.user_id == "user-a"
    assert summary.session_id == "session-1"
    assert summary.total_operations == 3
    assert round(summary.total_duration_ms, 2) == 12.5
    assert [item.operation for item in summary.operations] == [
        "context.append_messages.insert",
        "acquire_conn",
    ]
    assert summary.operations[0].count == 2
    assert round(summary.operations[0].total_duration_ms, 2) == 10.5
    assert round(summary.operations[0].max_duration_ms, 2) == 7.0


def test_format_query_pg_observation_includes_top_operations() -> None:
    # 测试内容：query PG 摘要字符串应包含 trace、会话和 top operation 统计，方便压测时直接检索。
    token = begin_query_pg_observation("trace-2", user_id="user-b", session_id="session-2")
    log_pg_timing("wire.append_record.insert_record", 5.0)
    log_pg_timing("touch_session_updated_at", 1.5)

    summary = finish_query_pg_observation(token)

    assert summary is not None
    text = format_query_pg_observation(summary)
    assert "query_id=trace-2" in text
    assert "session_id=session-2" in text
    assert "total_operations=2" in text
    assert "wire.append_record.insert_record[count=1,total_ms=5.00,max_ms=5.00]" in text


@pytest.mark.asyncio
async def test_touch_session_updated_at_reuses_supplied_conn(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # 测试内容：传入现有 PG 连接时，应复用该连接完成 touch，而不是再次 acquire_conn。
    conn = AsyncMock()

    async def _unexpected_acquire_conn():
        raise AssertionError("acquire_conn should not be called when conn is supplied")

    monkeypatch.setattr("kimi_cli.store.rdb.runtime.acquire_conn", _unexpected_acquire_conn)

    await touch_session_updated_at("user-a", "session-1", conn=conn)

    conn.execute.assert_awaited_once()


def test_verified_target_cache_is_task_local() -> None:
    # 测试内容：同一任务内标记过的 context/wire target 应命中 verified cache。
    assert is_context_target_verified("user-a", "session", "session-1") is False
    assert is_wire_target_verified("user-a", "session", "session-1") is False

    mark_context_target_verified("user-a", "session", "session-1")
    mark_wire_target_verified("user-a", "session", "session-1")

    assert is_context_target_verified("user-a", "session", "session-1") is True
    assert is_wire_target_verified("user-a", "session", "session-1") is True
