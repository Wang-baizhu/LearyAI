"""覆盖最小同步后的 CLI/Shell 关键行为。"""

from __future__ import annotations

import pytest

from kimi_cli.cli import Reload
from kimi_cli.cli import _build_env_runtime_context
from kimi_cli.soul import StatusSnapshot
from kimi_cli.soul.kimisoul import KimiSoul
from kimi_cli.ui.shell import Shell


def test_reload_supports_prefill_text() -> None:
    exc = Reload(session_id="session-1", prefill_text="继续处理上一个任务")
    assert exc.session_id == "session-1"
    assert exc.prefill_text == "继续处理上一个任务"


def test_reload_prefill_text_default_none() -> None:
    exc = Reload(session_id="session-2")
    assert exc.session_id == "session-2"
    assert exc.prefill_text is None


def test_shell_exit_command_allows_surrounding_spaces() -> None:
    assert Shell._is_exit_command("  /exit  ")
    assert Shell._is_exit_command(" quit ")
    assert not Shell._is_exit_command(" /exit now ")


def test_build_env_runtime_context_reads_leary_user_and_kb_id(monkeypatch) -> None:
    monkeypatch.setenv("LEARY_USER_ID", " 1 ")
    monkeypatch.setenv("LEARY_KB_ID", " 55acf6a5-7e86-4a8c-affd-82746d21b164 ")

    user_id, kb_id = _build_env_runtime_context()

    assert user_id == "1"
    assert kb_id == "55acf6a5-7e86-4a8c-affd-82746d21b164"


def test_build_env_runtime_context_treats_blank_values_as_missing(monkeypatch) -> None:
    monkeypatch.setenv("LEARY_USER_ID", "   ")
    monkeypatch.setenv("LEARY_KB_ID", "")

    user_id, kb_id = _build_env_runtime_context()

    assert user_id is None
    assert kb_id is None


class _FakePromptSession:
    def __init__(self, *args, **kwargs) -> None:
        self.prefill_text: str | None = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        return None

    def set_prefill_text(self, text: str) -> None:
        self.prefill_text = text

    async def prompt(self):
        raise EOFError


class _StubKimiSoul(KimiSoul):
    def __init__(self) -> None:
        self._available_slash_commands = []
        self._status = StatusSnapshot(context_usage=0.0, yolo_enabled=False)
        self._context = type("ContextStub", (), {"history": ["h1", "h2"]})()
        self._wire_file = "wire-file"

    @property
    def name(self) -> str:
        return "Fake Soul"

    @property
    def available_slash_commands(self):
        return self._available_slash_commands

    @property
    def model_capabilities(self):
        return set()

    @property
    def model_name(self) -> str:
        return "fake-model"

    @property
    def thinking(self) -> bool:
        return False

    @property
    def status(self) -> StatusSnapshot:
        return self._status

    @property
    def context(self):
        return self._context

    @property
    def wire_file(self):
        return self._wire_file


@pytest.mark.asyncio
async def test_shell_run_replays_recent_history_for_kimisoul(monkeypatch) -> None:
    replay_calls: list[tuple[object, object]] = []

    monkeypatch.setattr("kimi_cli.ui.shell._print_welcome_info", lambda *args, **kwargs: None)
    monkeypatch.setattr("kimi_cli.ui.shell.ensure_tty_sane", lambda: None)
    monkeypatch.setattr("kimi_cli.ui.shell.ensure_new_line", lambda: None)
    monkeypatch.setattr("kimi_cli.ui.shell.CustomPromptSession", _FakePromptSession)
    
    async def _fake_replay_recent_history(history, *, wire_file=None) -> None:
        replay_calls.append((history, wire_file))

    monkeypatch.setattr("kimi_cli.ui.shell.replay_recent_history", _fake_replay_recent_history)

    shell = Shell(_StubKimiSoul())

    assert await shell.run() is True
    assert replay_calls == [(["h1", "h2"], "wire-file")]
