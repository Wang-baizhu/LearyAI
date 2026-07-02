# 该文件职责：验证默认 agent 的系统提示词与工具集配置。

from __future__ import annotations

import platform

import pytest

from kimi_cli.agentspec import DEFAULT_AGENT_FILE
from kimi_cli.soul.agent import Runtime, load_agent


@pytest.mark.skipif(platform.system() == "Windows", reason="Skipping test on Windows")
async def test_default_agent(runtime: Runtime):
    """验证：default agent。"""
    agent = await load_agent(DEFAULT_AGENT_FILE, runtime, mcp_configs=[])

    normalized_prompt = agent.system_prompt.replace(
        f"{runtime.builtin_args.KIMI_WORK_DIR}", "/path/to/work/dir"
    )
    assert "你是 **Leary AI**" in normalized_prompt
    assert "## 知识库检索通用规范" in normalized_prompt
    assert "`KnowledgeBaseSearch`" in normalized_prompt
    assert "`KnowledgeBaseFetch`" in normalized_prompt

    tool_names = [tool.name for tool in agent.toolset.tools]
    assert tool_names == [
        "KnowledgeBaseSearch",
        "KnowledgeBaseFetch",
        "KnowledgeBaseDocInfo",
        "Agent",
        "AskUserQuestion",
    ]

    agent_tool = next(tool for tool in agent.toolset.tools if tool.name == "Agent")
    assert "`explorer`" in agent_tool.description
