"""该文件职责：在 ChatProvider.generate 边界执行单次调用额度控制。"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Self

from kosong.chat_provider import ChatProvider, StreamedMessage, StreamedMessagePart, TokenUsage
from kosong.message import Message
from kosong.tooling import Tool

from usage_control.billing import calculate_billing_points
from usage_control.client import UsageControlClient
from usage_control.context import TurnUsageContext
from usage_control.errors import UsageCallDeniedError
from usage_control.models import CurrentPolicy, TurnLease
from usage_control.outbox import get_usage_delivery_runtime
from usage_control.outbox.models import UsageOutboxEvent

@dataclass(slots=True)
class UsageControlledChatProvider:
    _delegate: ChatProvider
    _client: UsageControlClient
    _turn_context: TurnUsageContext

    name: str = "usage_controlled"

    @property
    def model_name(self) -> str:
        return self._delegate.model_name

    @property
    def thinking_effort(self):
        return self._delegate.thinking_effort

    async def generate(
        self,
        system_prompt: str,
        tools: Sequence[Tool],
        history: Sequence[Message],
    ) -> StreamedMessage:
        call_id = self._turn_context.next_call_id()
        reservation_id = f"reservation:{call_id}"
        request_id = call_id
        # 当前准入语义是“只要还有可用量就允许放行”，这里不是精确预扣。
        reservation_points = 1
        if self._turn_context.policy is not None and self._turn_context.policy.available > 0:
            reservation_points = min(max(self._turn_context.policy.available, 1), 2048)
        metadata = {
            "service": self._turn_context.service,
            "channel": self._turn_context.channel,
            "sessionId": self._turn_context.session_id,
            "turnId": self._turn_context.turn_id,
            "callId": call_id,
        }
        should_release_on_generate_failure = False
        if self._turn_context.kb_id:
            metadata["kbId"] = self._turn_context.kb_id
        if self._turn_context.policy and self._turn_context.policy.policy_mode == "NON_MEMBER":
            reserved, policy = await self._client.reserve_single_call(
                user_id=self._turn_context.user_id,
                project_id=self._turn_context.project_id,
                metric=self._turn_context.metric,
                reservation_id=reservation_id,
                request_id=request_id,
                requested_amount=reservation_points,
                reservation_ttl_seconds=1800,
                metadata=metadata,
            )
            self._turn_context.policy = policy
            if not reserved:
                raise UsageCallDeniedError("single call denied before llm request")
            should_release_on_generate_failure = True
        try:
            stream = await self._delegate.generate(system_prompt, tools, history)
        except BaseException:
            if should_release_on_generate_failure:
                _, policy = await self._client.release_single_call(
                    user_id=self._turn_context.user_id,
                    project_id=self._turn_context.project_id,
                    metric=self._turn_context.metric,
                    reservation_id=reservation_id,
                    request_id=request_id,
                )
                self._turn_context.policy = policy
            raise
        return _UsageControlledStream(
            stream=stream,
            client=self._client,
            turn_context=self._turn_context,
            call_id=call_id,
            reservation_id=reservation_id,
            request_id=request_id,
            requested_amount=reservation_points,
            model_name=self.model_name,
            thinking_effort=self.thinking_effort,
        )

    def with_thinking(self, effort) -> Self:
        return UsageControlledChatProvider(
            _delegate=self._delegate.with_thinking(effort),
            _client=self._client,
            _turn_context=self._turn_context,
        )


@dataclass(slots=True)
class _UsageControlledStream:
    stream: StreamedMessage
    client: UsageControlClient
    turn_context: TurnUsageContext
    call_id: str
    reservation_id: str
    request_id: str
    requested_amount: int
    model_name: str
    thinking_effort: str | None
    _finalized: bool = False

    def __aiter__(self) -> AsyncIterator[StreamedMessagePart]:
        return self._iterate()

    @property
    def id(self) -> str | None:
        return self.stream.id

    @property
    def usage(self) -> TokenUsage | None:
        return self.stream.usage

    async def _iterate(self) -> AsyncIterator[StreamedMessagePart]:
        try:
            async for part in self.stream:
                yield part
        except BaseException:
            await self._release_if_needed()
            raise
        await self._commit_if_needed()

    async def _commit_if_needed(self) -> None:
        if self._finalized:
            return
        self._finalized = True
        usage = self.stream.usage
        if usage is None:
            await self._release_if_needed()
            return
        billing = calculate_billing_points(usage)
        metadata = self._build_commit_metadata(billing)
        occurred_at = datetime.now(tz=UTC).isoformat().replace("+00:00", "Z")
        if self.turn_context.policy and self.turn_context.policy.policy_mode == "MEMBER":
            lease = self.turn_context.lease
            if lease is None:
                raise UsageCallDeniedError("member lease missing before commit")
            payload = {
                "user_id": self.turn_context.user_id,
                "project_id": self.turn_context.project_id,
                "metric": self.turn_context.metric,
                "lease_id": lease.lease_id,
                "turn_id": self.turn_context.turn_id,
                "call_id": self.call_id,
                "actual_amount": billing.points,
                "idempotency_key": f"turn:{self.turn_context.turn_id}:call:{self.call_id}:commit",
                "source_type": self.turn_context.source_type,
                "source_id": self.call_id,
                "metadata": metadata,
                "occurred_at": occurred_at,
            }
            updated_lease, updated_policy = await self._commit_member_usage(payload)
            self.turn_context.lease = updated_lease
            self.turn_context.policy = updated_policy
            return
        payload = {
            "user_id": self.turn_context.user_id,
            "project_id": self.turn_context.project_id,
            "metric": self.turn_context.metric,
            "reservation_id": self.reservation_id,
            "request_id": self.request_id,
            "requested_amount": self.requested_amount,
            "actual_amount": billing.points,
            "idempotency_key": f"turn:{self.turn_context.turn_id}:call:{self.call_id}:commit-single-call",
            "source_type": self.turn_context.source_type,
            "source_id": self.call_id,
            "metadata": metadata,
            "occurred_at": occurred_at,
        }
        updated_policy = await self._commit_single_call_usage(payload)
        self.turn_context.policy = updated_policy

    async def _commit_member_usage(self, payload: dict[str, object]) -> tuple[TurnLease, CurrentPolicy]:
        try:
            _, updated_lease, updated_policy = await self.client.commit_turn_call_usage(**payload)
            return updated_lease, updated_policy
        except Exception:
            await self._enqueue_commit_retry("commit_turn_call_usage", payload)
            lease = self.turn_context.lease
            policy = self.turn_context.policy
            if lease is None or policy is None:
                raise UsageCallDeniedError("member usage state missing after commit enqueue")
            return lease, policy

    async def _commit_single_call_usage(self, payload: dict[str, object]) -> CurrentPolicy:
        try:
            _, updated_policy = await self.client.commit_single_call(**payload)
            return updated_policy
        except Exception:
            await self._enqueue_commit_retry("commit_single_call", payload)
            policy = self.turn_context.policy
            if policy is None:
                raise UsageCallDeniedError("single call policy missing after commit enqueue")
            return policy

    async def _enqueue_commit_retry(self, event_type: str, payload: dict[str, object]) -> None:
        await get_usage_delivery_runtime(self.client).enqueue(
            UsageOutboxEvent(
                event_type=event_type,
                idempotency_key=str(payload["idempotency_key"]),
                payload=payload,
            )
        )

    async def _release_if_needed(self) -> None:
        if self._finalized:
            return
        self._finalized = True
        if self.turn_context.policy and self.turn_context.policy.policy_mode == "NON_MEMBER":
            _, policy = await self.client.release_single_call(
                user_id=self.turn_context.user_id,
                project_id=self.turn_context.project_id,
                metric=self.turn_context.metric,
                reservation_id=self.reservation_id,
                request_id=self.request_id,
            )
            self.turn_context.policy = policy

    def _build_commit_metadata(self, billing) -> dict[str, str]:
        payload = {
            "usageType": "llm_call",
            "source": {
                "service": self.turn_context.service,
                "channel": self.turn_context.channel,
                "sessionId": self.turn_context.session_id,
                "turnId": self.turn_context.turn_id,
                "callId": self.call_id,
                "messageId": self.stream.id or "",
            },
            "billing": {
                "ruleVersion": billing.rule_version,
                "points": billing.points,
                "weights": billing.weights.as_strings(),
            },
            "rawUsage": {
                "inputOther": billing.input_other,
                "inputCacheRead": billing.input_cache_read,
                "inputCacheCreation": billing.input_cache_creation,
                "output": billing.output,
                "totalInput": billing.total_input,
                "totalTokens": billing.total_tokens,
            },
            "model": {
                "modelName": self.model_name,
                "thinkingEffort": self.thinking_effort or "",
            },
            "biz": {
                "userId": self.turn_context.user_id,
                "projectId": self.turn_context.project_id,
                "kbId": self.turn_context.kb_id or "",
                "planId": self.turn_context.policy.plan_id if self.turn_context.policy else "",
                "policyMode": self.turn_context.policy.policy_mode if self.turn_context.policy else "NON_MEMBER",
            },
        }
        return {
            "turnId": self.turn_context.turn_id,
            "callId": self.call_id,
            "messageId": self.stream.id or "",
            "usagePayload": json.dumps(payload, separators=(",", ":")),
        }
