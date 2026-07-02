from __future__ import annotations

import pytest
from inline_snapshot import snapshot

from kimi_cli.config import (
    Config,
    Services,
    get_default_config,
    load_config_from_string,
)
from kimi_cli.exception import ConfigError


def test_default_config():
    """验证：default config。"""
    config = get_default_config()
    assert config == snapshot(
        Config(
            default_model="",
            default_thinking=False,
            models={},
            providers={},
            services=Services(),
        )
    )


def test_default_config_dump():
    """验证：default config dump。"""
    config = get_default_config()
    assert config.model_dump() == snapshot(
        {
            "default_model": "",
            "default_thinking": False,
            "default_yolo": False,
            "default_plan_mode": False,
            "defer_mcp_loading": True,
            "models": {},
            "providers": {},
            "loop_control": {
                "max_steps_per_turn": 100,
                "max_subagent_depth": 1,
                "max_retries_per_step": 3,
                "max_ralph_iterations": 0,
                "reserved_context_size": 50000,
            },
            "services": {"moonshot_search": None, "moonshot_fetch": None},
            "mcp": {"client": {"tool_call_timeout_ms": 60000}},
            "notifications": {
                "claim_stale_after_ms": 120000,
                "llm_batch_size": 8,
                "notification_tail_chars": 8000,
                "notification_tail_lines": 120,
            },
            "background": {
                "enabled": True,
                "max_running_tasks": 8,
                "agent_task_timeout_s": 900,
                "worker_heartbeat_interval_ms": 1000,
                "wait_poll_interval_ms": 500,
                "kill_grace_period_ms": 3000,
            },
            "hooks": [],
        }
    )


def test_load_config_text_toml():
    """验证：load config text toml。"""
    config = load_config_from_string('default_model = ""\n')
    assert config == get_default_config()


def test_load_config_text_json():
    """验证：load config text json。"""
    config = load_config_from_string('{"default_model": ""}')
    assert config == get_default_config()


def test_load_config_text_toml_hooks_list():
    """验证：load config text toml hooks list。"""
    config = load_config_from_string(
        '\n'.join(
            [
                'default_model = ""',
                '',
                '[[hooks]]',
                'event = "PreToolUse"',
                'command = "echo test"',
                'matcher = ""',
                'timeout = 30',
                '',
            ]
        )
    )
    assert [hook.model_dump() for hook in config.hooks] == snapshot(
        [
            {
                "event": "PreToolUse",
                "command": "echo test",
                "matcher": "",
                "timeout": 30,
            }
        ]
    )


def test_load_config_text_invalid():
    """验证：load config text invalid。"""
    with pytest.raises(ConfigError, match="Invalid configuration text"):
        load_config_from_string("not valid {")


def test_load_config_invalid_ralph_iterations():
    """验证：load config invalid ralph iterations。"""
    with pytest.raises(ConfigError, match="max_ralph_iterations"):
        load_config_from_string('{"loop_control": {"max_ralph_iterations": -2}}')


def test_load_config_reserved_context_size():
    """验证：load config reserved context size。"""
    config = load_config_from_string('{"loop_control": {"reserved_context_size": 30000}}')
    assert config.loop_control.reserved_context_size == 30000


def test_load_config_reserved_context_size_too_low():
    """验证：load config reserved context size too low。"""
    with pytest.raises(ConfigError, match="reserved_context_size"):
        load_config_from_string('{"loop_control": {"reserved_context_size": 500}}')


def test_load_config_subagent_depth():
    """验证：load config subagent depth。"""
    config = load_config_from_string('{"loop_control": {"max_subagent_depth": 2}}')
    assert config.loop_control.max_subagent_depth == 2


def test_load_config_subagent_depth_too_low():
    """验证：load config subagent depth too low。"""
    with pytest.raises(ConfigError, match="max_subagent_depth"):
        load_config_from_string('{"loop_control": {"max_subagent_depth": -1}}')
