# 该文件职责：验证 Runtime 在 root / subagent 角色下的复制行为与共享边界。

from __future__ import annotations

from kimi_cli.soul.agent import Runtime
from kimi_cli.soul.denwarenji import DenwaRenji


def test_runtime_copy_for_fixed_subagent_preserves_shared_services(runtime: Runtime) -> None:
    copied = runtime.copy_for_fixed_subagent()

    assert copied.role == "fixed_subagent"
    assert copied.session is runtime.session
    assert copied.approval is runtime.approval
    assert copied.skills is runtime.skills
    assert copied.notifications is runtime.notifications
    assert copied.root_wire_hub is runtime.root_wire_hub
    assert copied.approval_runtime is runtime.approval_runtime
    assert copied.denwa_renji is not runtime.denwa_renji
    assert isinstance(copied.denwa_renji, DenwaRenji)
    assert copied.background_tasks is None


def test_runtime_copy_for_dynamic_subagent_shares_labor_market(runtime: Runtime) -> None:
    runtime.extra_tool_classes = (str,)
    copied = runtime.copy_for_dynamic_subagent()

    assert copied.role == "dynamic_subagent"
    assert copied.labor_market is runtime.labor_market
    assert copied.session is runtime.session
    assert copied.subagent_store is runtime.subagent_store
    assert copied.oauth is runtime.oauth
    assert copied.denwa_renji is not runtime.denwa_renji
    assert copied.extra_tool_classes == (str,)


def test_runtime_copy_for_subagent_uses_override_llm(runtime: Runtime) -> None:
    runtime.extra_tool_classes = (str,)
    copied = runtime.copy_for_subagent(
        agent_id="agent-1",
        subagent_type="explorer",
        llm_override=None,
    )

    assert copied.role == "subagent:explorer:agent-1"
    assert copied.llm is None
    assert copied.labor_market is runtime.labor_market
    assert copied.session is runtime.session
    assert copied.background_tasks is None
    assert copied.extra_tool_classes == (str,)


def test_runtime_copies_share_run_state_registry(runtime: Runtime) -> None:
    copied = runtime.copy_for_subagent(
        agent_id="agent-1",
        subagent_type="explorer",
        llm_override=None,
    )

    assert copied.run_state_registry is runtime.run_state_registry
