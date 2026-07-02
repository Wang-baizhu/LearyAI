"""该文件职责：验证 runtime 级通知组件的基本连通性与共享行为。"""

from __future__ import annotations

from kimi_cli.notifications import NotificationEvent


def test_runtime_notifications_publish_and_claim(runtime) -> None:
    event = runtime.notifications.publish(
        NotificationEvent(
            id=runtime.notifications.new_id(),
            category="system",
            type="system.info",
            source_kind="test",
            source_id="source-1",
            title="Info",
            body="hello",
            targets=["wire"],
        )
    )
    claimed = runtime.notifications.claim_for_sink("wire", limit=1)
    assert [view.event.id for view in claimed] == [event.event.id]


def test_runtime_copy_for_subagent_shares_notification_manager(runtime) -> None:
    copied = runtime.copy_for_subagent(
        agent_id="agent-1",
        subagent_type="explorer",
        llm_override=None,
    )
    assert copied.notifications is runtime.notifications
