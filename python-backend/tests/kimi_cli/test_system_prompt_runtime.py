# 该文件职责：验证 runtime 级 system prompt 变量的归一化、刷新与 subagent 继承行为。

from __future__ import annotations

from types import SimpleNamespace
import unittest

try:
    from kimi_cli.soul.agent import Runtime, normalize_system_prompt_vars
    from kimi_cli.soul.kimisoul import KimiSoul
except ModuleNotFoundError as exc:
    if exc.name in {"kimi_cli", "kaos", "kosong"}:
        Runtime = None  # type: ignore[assignment]
        KimiSoul = None  # type: ignore[assignment]
        normalize_system_prompt_vars = None  # type: ignore[assignment]
    else:
        raise


class _FakeSoul:
    def __init__(self, template: str, vars: dict[str, str]) -> None:
        self._runtime = SimpleNamespace(system_prompt_vars=vars)
        self._system_prompt_override: str | None = None
        self._agent = SimpleNamespace(system_prompt=template)

    def render_system_prompt(self, variables: dict[str, str]) -> str:
        return KimiSoul.render_system_prompt(self, variables)

    def render_runtime_system_prompt(self) -> str:
        return KimiSoul.render_runtime_system_prompt(self)


@unittest.skipIf(
    Runtime is None or KimiSoul is None or normalize_system_prompt_vars is None,
    "kimi_cli dependencies not installed",
)
class RuntimeSystemPromptTests(unittest.TestCase):
    # 测试内容：运行时变量会合并默认值，并把 None 归一化为空字符串。
    def test_normalize_system_prompt_vars(self) -> None:
        result = normalize_system_prompt_vars({"doc_summary": None, "ignored": "x"})

        self.assertEqual(result, {"doc_summary": "", "extra_info": ""})

    # 测试内容：相同变量不重复标记变化，变化后会更新最新值。
    def test_runtime_update_system_prompt_vars_detects_changes(self) -> None:
        runtime = SimpleNamespace(system_prompt_vars={"doc_summary": "", "extra_info": ""})

        changed = Runtime.update_system_prompt_vars(runtime, {"doc_summary": "", "extra_info": ""})
        self.assertFalse(changed)
        self.assertEqual(runtime.system_prompt_vars, {"doc_summary": "", "extra_info": ""})

        changed = Runtime.update_system_prompt_vars(runtime, {"doc_summary": "- doc-1(spec)", "extra_info": "ctx"})
        self.assertTrue(changed)
        self.assertEqual(runtime.system_prompt_vars, {"doc_summary": "- doc-1(spec)", "extra_info": "ctx"})

    # 测试内容：soul 只在最终渲染结果变化时刷新 override。
    def test_refresh_system_prompt_from_runtime_only_when_changed(self) -> None:
        soul = _FakeSoul("Doc summary:\n${doc_summary}\nExtra:\n${extra_info}", {"doc_summary": "", "extra_info": ""})

        changed = KimiSoul.refresh_system_prompt_from_runtime(soul)
        self.assertTrue(changed)
        self.assertEqual(soul._system_prompt_override, "Doc summary:\n\nExtra:")

        changed = KimiSoul.refresh_system_prompt_from_runtime(soul)
        self.assertFalse(changed)
        self.assertEqual(soul._system_prompt_override, "Doc summary:\n\nExtra:")

        soul._runtime.system_prompt_vars = {"doc_summary": "- doc-1(spec)", "extra_info": "ctx"}
        changed = KimiSoul.refresh_system_prompt_from_runtime(soul)
        self.assertTrue(changed)
        self.assertEqual(soul._system_prompt_override, "Doc summary:\n- doc-1(spec)\nExtra:\nctx")

    # 测试内容：subagent runtime 复制时会带上当前最新的动态提示变量。
    def test_copy_for_subagent_keeps_system_prompt_vars(self) -> None:
        runtime = Runtime(
            config=SimpleNamespace(),
            llm=None,
            session=SimpleNamespace(id="session-1"),
            builtin_args=SimpleNamespace(),
            denwa_renji=SimpleNamespace(),
            approval=SimpleNamespace(),
            labor_market=SimpleNamespace(),
            environment=SimpleNamespace(),
            skills={},
            system_prompt_vars={"doc_summary": "- doc-1(spec)", "extra_info": "ctx"},
            role="root",
            notifications=None,
            background_tasks=None,
            approval_runtime=None,
            root_wire_hub=None,
            hook_engine=None,
            oauth=None,
            subagent_store=None,
        )

        child = runtime.copy_for_subagent(
            agent_id="a1234567",
            subagent_type="explorer",
            llm_override=None,
        )

        self.assertEqual(child.system_prompt_vars, {"doc_summary": "- doc-1(spec)", "extra_info": "ctx"})
        self.assertIsNot(child.system_prompt_vars, runtime.system_prompt_vars)


if __name__ == "__main__":
    unittest.main()
