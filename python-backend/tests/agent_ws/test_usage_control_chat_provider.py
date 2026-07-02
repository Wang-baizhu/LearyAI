# 该文件职责：验证 usage-control 包装后的 ChatProvider 在会员/非会员模式下的提交与释放行为。

from __future__ import annotations

from dataclasses import dataclass
from types import SimpleNamespace
import pytest

from kosong.chat_provider import TokenUsage
from usage_control import chat_provider as chat_provider_module
from usage_control.chat_provider import UsageControlledChatProvider
from usage_control.context import TurnUsageContext
from usage_control.models import CurrentPolicy, TurnLease


@dataclass
class _FakeStream:
    parts: list[object]
    usage: TokenUsage | None
    id: str | None = "msg-1"
    fail_on_iter: bool = False

    def __aiter__(self):
        return self._iterate()

    async def _iterate(self):
        if self.fail_on_iter:
            raise RuntimeError("boom")
        for part in self.parts:
            yield part


@dataclass
class _FakeProvider:
    stream: _FakeStream
    model_name: str = "fake-model"
    thinking_effort: str | None = "off"
    raise_on_generate: bool = False

    async def generate(self, system_prompt, tools, history):
        if self.raise_on_generate:
            raise RuntimeError("generate failed")
        return self.stream

    def with_thinking(self, effort):
        return self


class _FakeClient:
    def __init__(self) -> None:
        self.reserve_calls: list[dict[str, object]] = []
        self.commit_calls: list[dict[str, object]] = []
        self.release_calls: list[dict[str, object]] = []

    async def reserve_single_call(self, **kwargs):
        self.reserve_calls.append(kwargs)
        return True, CurrentPolicy(1, "project-1", "ai_chat_tokens", 7, "", 100, 0, 1, 99, "NON_MEMBER")

    async def commit_single_call(self, **kwargs):
        self.commit_calls.append(kwargs)
        return True, CurrentPolicy(1, "project-1", "ai_chat_tokens", 7, "", 100, 5, 0, 95, "NON_MEMBER")

    async def release_single_call(self, **kwargs):
        self.release_calls.append(kwargs)
        return True, CurrentPolicy(1, "project-1", "ai_chat_tokens", 7, "", 100, 0, 0, 100, "NON_MEMBER")

    async def commit_turn_call_usage(self, **kwargs):
        self.commit_calls.append(kwargs)
        return True, TurnLease("lease-1", 1, "project-1", "ai_chat_tokens", "turn-1", "pro", "OPEN", "a", "b", "c"), CurrentPolicy(1, "project-1", "ai_chat_tokens", 7, "pro", 100, 5, 0, 95, "MEMBER")


class _FailCommitClient(_FakeClient):
    async def commit_single_call(self, **kwargs):
        self.commit_calls.append(kwargs)
        raise RuntimeError("grpc down")

    async def commit_turn_call_usage(self, **kwargs):
        self.commit_calls.append(kwargs)
        raise RuntimeError("grpc down")


@pytest.mark.asyncio
async def test_non_member_stream_commit_after_success() -> None:
    client = _FakeClient()
    provider = UsageControlledChatProvider(
        _delegate=_FakeProvider(_FakeStream(parts=["chunk"], usage=TokenUsage(input_other=2, output=1))),
        _client=client,
        _turn_context=TurnUsageContext(
            user_id=1,
            project_id="project-1",
            metric="ai_chat_tokens",
            service="agent_ws",
            channel="chat",
            session_id="session-1",
            kb_id=None,
            policy=CurrentPolicy(1, "project-1", "ai_chat_tokens", 7, "", 100, 0, 0, 100, "NON_MEMBER"),
        ),
    )

    stream = await provider.generate("", [], [])
    parts = [part async for part in stream]

    assert parts == ["chunk"]
    assert len(client.reserve_calls) == 1
    assert len(client.commit_calls) == 1
    assert client.release_calls == []


@pytest.mark.asyncio
async def test_non_member_stream_releases_on_failure() -> None:
    client = _FakeClient()
    provider = UsageControlledChatProvider(
        _delegate=_FakeProvider(_FakeStream(parts=[], usage=None, fail_on_iter=True)),
        _client=client,
        _turn_context=TurnUsageContext(
            user_id=1,
            project_id="project-1",
            metric="ai_chat_tokens",
            service="agent_ws",
            channel="chat",
            session_id="session-1",
            kb_id=None,
            policy=CurrentPolicy(1, "project-1", "ai_chat_tokens", 7, "", 100, 0, 0, 100, "NON_MEMBER"),
        ),
    )

    stream = await provider.generate("", [], [])
    with pytest.raises(RuntimeError):
        _ = [part async for part in stream]

    assert len(client.reserve_calls) == 1
    assert client.commit_calls == []
    assert len(client.release_calls) == 1


@pytest.mark.asyncio
async def test_non_member_generate_failure_releases_reservation() -> None:
    client = _FakeClient()
    provider = UsageControlledChatProvider(
        _delegate=_FakeProvider(
            _FakeStream(parts=[], usage=None),
            raise_on_generate=True,
        ),
        _client=client,
        _turn_context=TurnUsageContext(
            user_id=1,
            project_id="project-1",
            metric="ai_chat_tokens",
            service="agent_ws",
            channel="chat",
            session_id="session-1",
            kb_id=None,
            policy=CurrentPolicy(1, "project-1", "ai_chat_tokens", 7, "", 100, 0, 0, 100, "NON_MEMBER"),
        ),
    )

    with pytest.raises(RuntimeError, match="generate failed"):
        await provider.generate("", [], [])

    assert len(client.reserve_calls) == 1
    assert client.commit_calls == []
    assert len(client.release_calls) == 1


@pytest.mark.asyncio
async def test_member_stream_commits_turn_call() -> None:
    client = _FakeClient()
    provider = UsageControlledChatProvider(
        _delegate=_FakeProvider(_FakeStream(parts=["chunk"], usage=TokenUsage(input_other=1, output=1))),
        _client=client,
        _turn_context=TurnUsageContext(
            user_id=1,
            project_id="project-1",
            metric="ai_chat_tokens",
            service="agent_ws",
            channel="chat",
            session_id="session-1",
            kb_id="kb-1",
            turn_id="turn-1",
            policy=CurrentPolicy(1, "project-1", "ai_chat_tokens", 7, "pro", 100, 0, 0, 100, "MEMBER"),
            lease=TurnLease("lease-1", 1, "project-1", "ai_chat_tokens", "turn-1", "pro", "OPEN", "a", "b", "c"),
        ),
    )

    stream = await provider.generate("", [], [])
    _ = [part async for part in stream]

    assert client.reserve_calls == []
    assert len(client.commit_calls) == 1
    assert client.release_calls == []


@pytest.mark.asyncio
async def test_non_member_commit_failure_enqueues_outbox_and_does_not_fail_stream(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _FailCommitClient()
    enqueued_events: list[object] = []
    monkeypatch.setattr(
        chat_provider_module,
        "get_usage_delivery_runtime",
        lambda provided_client: SimpleNamespace(
            enqueue=lambda event: _collect_event(enqueued_events, event, provided_client, client)
        ),
    )
    provider = UsageControlledChatProvider(
        _delegate=_FakeProvider(_FakeStream(parts=["chunk"], usage=TokenUsage(input_other=2, output=1))),
        _client=client,
        _turn_context=TurnUsageContext(
            user_id=1,
            project_id="project-1",
            metric="ai_chat_tokens",
            service="agent_ws",
            channel="chat",
            session_id="session-1",
            kb_id=None,
            policy=CurrentPolicy(1, "project-1", "ai_chat_tokens", 7, "", 100, 0, 0, 100, "NON_MEMBER"),
        ),
    )

    stream = await provider.generate("", [], [])
    parts = [part async for part in stream]

    assert parts == ["chunk"]
    assert len(client.commit_calls) == 1
    assert len(enqueued_events) == 1
    assert enqueued_events[0].event_type == "commit_single_call"


@pytest.mark.asyncio
async def test_member_commit_failure_enqueues_outbox_and_does_not_fail_stream(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _FailCommitClient()
    enqueued_events: list[object] = []
    monkeypatch.setattr(
        chat_provider_module,
        "get_usage_delivery_runtime",
        lambda provided_client: SimpleNamespace(
            enqueue=lambda event: _collect_event(enqueued_events, event, provided_client, client)
        ),
    )
    provider = UsageControlledChatProvider(
        _delegate=_FakeProvider(_FakeStream(parts=["chunk"], usage=TokenUsage(input_other=1, output=1))),
        _client=client,
        _turn_context=TurnUsageContext(
            user_id=1,
            project_id="project-1",
            metric="ai_chat_tokens",
            service="agent_ws",
            channel="chat",
            session_id="session-1",
            kb_id="kb-1",
            turn_id="turn-1",
            policy=CurrentPolicy(1, "project-1", "ai_chat_tokens", 7, "pro", 100, 0, 0, 100, "MEMBER"),
            lease=TurnLease("lease-1", 1, "project-1", "ai_chat_tokens", "turn-1", "pro", "OPEN", "a", "b", "c"),
        ),
    )

    stream = await provider.generate("", [], [])
    parts = [part async for part in stream]

    assert parts == ["chunk"]
    assert len(client.commit_calls) == 1
    assert len(enqueued_events) == 1
    assert enqueued_events[0].event_type == "commit_turn_call_usage"


async def _collect_event(events: list[object], event: object, provided_client: object, expected_client: object) -> None:
    assert provided_client is expected_client
    events.append(event)
