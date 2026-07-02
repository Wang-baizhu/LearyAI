"""该文件职责：验证 NotificationManager 的去重、claim/ack 与恢复行为。"""

from __future__ import annotations

import time

import pytest

from kimi_cli.notifications import NotificationEvent


def test_publish_dedupes_and_tracks_sink_state(runtime) -> None:
    manager = runtime.notifications
    event = NotificationEvent(
        id=manager.new_id(),
        category="task",
        type="task.completed",
        source_kind="background_task",
        source_id="b1234567",
        title="Task completed",
        body="done",
        dedupe_key="background_task:b1234567:completed",
    )

    first = manager.publish(event)
    second = manager.publish(event.model_copy(update={"id": manager.new_id()}))

    assert first.event.id == second.event.id


def test_claim_for_sink_is_fifo_and_respects_limit(runtime) -> None:
    manager = runtime.notifications
    first = manager.publish(
        NotificationEvent(
            id=manager.new_id(),
            category="system",
            type="system.info",
            source_kind="test",
            source_id="source-1",
            title="First",
            body="first",
            created_at=time.time() - 2,
        )
    )
    second = manager.publish(
        NotificationEvent(
            id=manager.new_id(),
            category="system",
            type="system.info",
            source_kind="test",
            source_id="source-2",
            title="Second",
            body="second",
            created_at=time.time() - 1,
        )
    )

    assert [view.event.id for view in manager.claim_for_sink("wire", limit=1)] == [first.event.id]
    assert [view.event.id for view in manager.claim_for_sink("wire", limit=1)] == [second.event.id]


def test_ack_for_one_sink_does_not_consume_other_sinks(runtime) -> None:
    manager = runtime.notifications
    event = manager.publish(
        NotificationEvent(
            id=manager.new_id(),
            category="task",
            type="task.completed",
            source_kind="background_task",
            source_id="b1234567",
            title="Task completed",
            body="done",
            targets=["llm", "wire", "shell"],
        )
    )

    manager.ack("llm", event.event.id)
    assert [view.event.id for view in manager.claim_for_sink("wire", limit=1)] == [event.event.id]
    assert [view.event.id for view in manager.claim_for_sink("shell", limit=1)] == [event.event.id]


def test_recover_requeues_stale_claim(runtime) -> None:
    manager = runtime.notifications
    event = NotificationEvent(
        id=manager.new_id(),
        category="system",
        type="system.info",
        source_kind="test",
        source_id="source-1",
        title="Info",
        body="hello",
    )
    created = manager.publish(event)
    delivery = created.delivery.model_copy(deep=True)
    delivery.sinks["wire"].status = "claimed"
    delivery.sinks["wire"].claimed_at = time.time() - 180
    manager.store.write_delivery(created.event.id, delivery)

    manager.recover()

    recovered = manager.store.merged_view(created.event.id)
    assert recovered.delivery.sinks["wire"].status == "pending"


@pytest.mark.asyncio
async def test_deliver_pending_leaves_claimed_notification_for_recovery_on_handler_error(runtime) -> None:
    manager = runtime.notifications
    event = NotificationEvent(
        id=manager.new_id(),
        category="system",
        type="system.info",
        source_kind="test",
        source_id="source-1",
        title="Info",
        body="hello",
        targets=["wire"],
    )
    manager.publish(event)

    async def _boom(_view) -> None:
        raise RuntimeError("boom")

    delivered = await manager.deliver_pending("wire", on_notification=_boom)
    assert delivered == []
    stored = manager.store.merged_view(event.id)
    assert stored.delivery.sinks["wire"].status == "claimed"
