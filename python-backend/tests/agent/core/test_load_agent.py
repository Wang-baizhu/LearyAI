"""Tests for agent loading functionality."""

from __future__ import annotations

import tempfile
from collections.abc import Generator
from pathlib import Path
from typing import Any
from unittest.mock import patch

import pytest
from inline_snapshot import snapshot

from kimi_cli.config import Config
from kimi_cli.exception import InvalidToolError
from kimi_cli.session import Session
from kimi_cli.soul.agent import (
    BuiltinSystemPromptArgs,
    Runtime,
    _load_agent_blueprint,
    _load_resolved_agent_spec,
    _load_system_prompt,
    _load_system_prompt_template,
    load_agent,
)
from kimi_cli.soul.approval import Approval
from kimi_cli.soul.denwarenji import DenwaRenji
from kimi_cli.soul.toolset import KimiToolset
from kimi_cli.utils.environment import Environment
from agent_runtime.prompt import get_prompt_template_vars


def test_load_system_prompt(system_prompt_file: Path, builtin_args: BuiltinSystemPromptArgs):
    """Test loading system prompt with template substitution."""
    prompt = _load_system_prompt(system_prompt_file, {"CUSTOM_ARG": "test_value"}, builtin_args)

    assert "Test system prompt with " in prompt
    assert "1970-01-01" in prompt  # Should contain the actual timestamp
    assert builtin_args.KIMI_NOW in prompt
    assert "test_value" in prompt


def test_load_system_prompt_injects_shared_prompt_templates(
    builtin_args: BuiltinSystemPromptArgs, monkeypatch: pytest.MonkeyPatch
):
    """Test loading system prompt with shared prompt fragments."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)
        prompt_root = tmpdir / "prompt"
        common_root = prompt_root / "common"
        common_root.mkdir(parents=True)

        (common_root / "core.md").write_text("共享核心：${ROLE_ADDITIONAL}")
        (common_root / "kb.md").write_text("共享知识库：${doc_summary}")
        (common_root / "time.md").write_text("共享时间：${KIMI_NOW}")
        (common_root / "reminder.md").write_text("共享提醒")

        system_md = tmpdir / "system.md"
        system_md.write_text(
            "头部\n"
            "${PROMPT_COMMON_CORE}\n"
            "${PROMPT_COMMON_KB}\n"
            "${PROMPT_COMMON_TIME}\n"
            "${PROMPT_COMMON_REMINDER}"
        )

        monkeypatch.setenv("AGENT_RUNTIME_PROMPT_ROOT", str(prompt_root))
        prompt = _load_system_prompt(
            system_md,
            {"ROLE_ADDITIONAL": "角色补充", "doc_summary": "- doc-1(spec)"},
            builtin_args,
        )

        assert "头部" in prompt
        assert "共享核心：角色补充" in prompt
        assert "共享知识库：- doc-1(spec)" in prompt
        assert "共享时间：1970-01-01T00:00:00+00:00" in prompt
        assert "共享提醒" in prompt


def test_prompt_template_vars_are_cached(monkeypatch: pytest.MonkeyPatch):
    """Test prompt fragments are loaded from cache for the same root."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)
        prompt_root = tmpdir / "prompt"
        common_root = prompt_root / "common"
        common_root.mkdir(parents=True)

        core_file = common_root / "core.md"
        core_file.write_text("缓存前")

        monkeypatch.setenv("AGENT_RUNTIME_PROMPT_ROOT", str(prompt_root))
        first = get_prompt_template_vars()
        core_file.write_text("缓存后")
        second = get_prompt_template_vars()

        assert first["PROMPT_COMMON_CORE"] == "缓存前"
        assert second["PROMPT_COMMON_CORE"] == "缓存前"


def test_load_resolved_agent_spec_is_cached():
    """Test resolved agent spec parsing uses process cache for the same file."""
    with tempfile.TemporaryDirectory() as tmpdir:
        agent_file = Path(tmpdir) / "agent.yaml"
        agent_file.write_text("version: 1\nagent:\n  name: test\n  system_prompt_path: ./system.md\n  tools: []\n")
        _load_resolved_agent_spec.cache_clear()
        with patch("kimi_cli.soul.agent.load_agent_spec") as mock_load:
            mock_load.return_value = object()
            first = _load_resolved_agent_spec(str(agent_file.resolve()))
            second = _load_resolved_agent_spec(str(agent_file.resolve()))

    assert first is second
    mock_load.assert_called_once()


def test_load_system_prompt_template_is_cached(system_prompt_file: Path):
    """Test system prompt file content is cached for the same path."""
    _load_system_prompt_template.cache_clear()
    first = _load_system_prompt_template(str(system_prompt_file.resolve()))
    system_prompt_file.write_text("updated")
    second = _load_system_prompt_template(str(system_prompt_file.resolve()))

    assert first == second == "Test system prompt with ${KIMI_NOW} and ${CUSTOM_ARG}"


def test_load_agent_blueprint_is_cached():
    """Test recursive agent blueprint compilation uses process cache for the same file."""
    with tempfile.TemporaryDirectory() as tmpdir:
        root = Path(tmpdir)
        (root / "system.md").write_text("root")
        (root / "sub-system.md").write_text("sub")
        (root / "sub.yaml").write_text(
            "version: 1\nagent:\n  name: sub\n  system_prompt_path: ./sub-system.md\n  tools: []\n"
        )
        agent_file = root / "agent.yaml"
        agent_file.write_text(
            "version: 1\n"
            "agent:\n"
            "  name: root\n"
            "  system_prompt_path: ./system.md\n"
            "  tools: []\n"
            "  subagents:\n"
            "    explorer:\n"
            "      path: ./sub.yaml\n"
            "      description: sub desc\n"
        )

        _load_agent_blueprint.cache_clear()
        with patch("kimi_cli.soul.agent._load_resolved_agent_spec") as mock_load:
            from kimi_cli.agentspec import load_agent_spec

            mock_load.side_effect = lambda path: load_agent_spec(Path(path))
            first = _load_agent_blueprint(str(agent_file.resolve()))
            second = _load_agent_blueprint(str(agent_file.resolve()))

    assert first is second
    assert len(first.subagents) == 1
    assert mock_load.call_count == 2


def test_load_tools_valid(runtime: Runtime):
    """Test loading valid tools."""
    tool_paths = ["kimi_cli.tools.think:Think", "kimi_cli.tools.shell:Shell"]
    toolset = KimiToolset()
    toolset.load_tools(
        tool_paths,
        {
            Runtime: runtime,
            Config: runtime.config,
            BuiltinSystemPromptArgs: runtime.builtin_args,
            Session: runtime.session,
            DenwaRenji: runtime.denwa_renji,
            Approval: runtime.approval,
            Environment: runtime.environment,
        },
    )
    assert len(toolset.tools) == snapshot(2)


def test_load_tools_invalid(runtime: Runtime):
    """Test loading with invalid tool paths."""
    tool_paths = ["kimi_cli.tools.nonexistent:Tool", "kimi_cli.tools.think:Think"]
    toolset = KimiToolset()
    try:
        toolset.load_tools(
            tool_paths,
            {
                Runtime: runtime,
                Config: runtime.config,
                BuiltinSystemPromptArgs: runtime.builtin_args,
                Session: runtime.session,
                DenwaRenji: runtime.denwa_renji,
                Approval: runtime.approval,
            },
        )
        raise AssertionError("should fail to load non-existing tool")
    except InvalidToolError as e:
        assert "kimi_cli.tools.nonexistent:Tool" in str(e)


async def test_load_agent_invalid_tools(agent_file_invalid_tools: Path, runtime: Runtime):
    """Test loading agent with invalid tools raises ValueError."""
    with pytest.raises(ValueError, match="Invalid tools"):
        await load_agent(agent_file_invalid_tools, runtime, mcp_configs=[])


@pytest.fixture
def agent_file_invalid_tools() -> Generator[Path, Any, Any]:
    """Create an agent configuration file with invalid tools."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)

        # Create system.md
        system_md = tmpdir / "system.md"
        system_md.write_text("You are a test agent")

        # Create agent.yaml with invalid tools
        agent_yaml = tmpdir / "agent.yaml"
        agent_yaml.write_text("""
version: 1
agent:
  name: "Test Agent"
  system_prompt_path: ./system.md
  tools: ["kimi_cli.tools.nonexistent:Tool"]
""")

        yield agent_yaml


@pytest.fixture
def system_prompt_file() -> Generator[Path, Any, Any]:
    """Create a system prompt file with template variables."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)

        system_md = tmpdir / "system.md"
        system_md.write_text("Test system prompt with ${KIMI_NOW} and ${CUSTOM_ARG}")

        yield system_md
