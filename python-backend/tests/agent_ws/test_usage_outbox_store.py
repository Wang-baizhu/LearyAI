"""该文件职责：验证 usage delivery outbox 的 payload_json 反序列化行为。"""

from __future__ import annotations

import pytest

from usage_control.outbox.models import UsageOutboxRecord
from usage_control.outbox.store import UsageDeliveryOutboxStore


def test_to_record_decodes_json_string_payload() -> None:
    record = UsageDeliveryOutboxStore._to_record(
        {
            "id": 1,
            "event_type": "commit_single_call",
            "idempotency_key": "idempotency-1",
            "payload_json": '{"user_id":1,"project_id":"project-1"}',
            "status": "pending",
        }
    )

    assert record == UsageOutboxRecord(
        id=1,
        event_type="commit_single_call",
        idempotency_key="idempotency-1",
        payload={"user_id": 1, "project_id": "project-1"},
        status="pending",
    )


def test_to_record_rejects_non_object_payload() -> None:
    with pytest.raises(TypeError, match="payload_json must decode to object"):
        UsageDeliveryOutboxStore._to_record(
            {
                "id": 1,
                "event_type": "commit_single_call",
                "idempotency_key": "idempotency-1",
                "payload_json": '["not-an-object"]',
                "status": "pending",
            }
        )
