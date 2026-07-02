# 该文件职责：验证 tasks_server runtime 的 agentTaskType 到 agent/skill/flow 配置映射。

from __future__ import annotations

import unittest

try:
    from tasks_server.runtime.agent_config import resolve_agent_task_runtime
except ModuleNotFoundError as exc:
    if exc.name in {"kaos"}:
        resolve_agent_task_runtime = None  # type: ignore[assignment]
    else:
        raise


@unittest.skipIf(resolve_agent_task_runtime is None, "agent runtime deps not installed")
class AgentConfigRuntimeTests(unittest.TestCase):
    # 测试内容：search 任务应映射到 kbexplorer agent 和 kb-explorer flow。
    def test_resolve_agent_task_runtime_supports_search(self) -> None:
        runtime = resolve_agent_task_runtime("search")

        self.assertEqual(runtime.skills_type, "kbsummary")
        self.assertEqual(runtime.agent_type, "kbexplorer")
        self.assertEqual(runtime.flow_name, "kb-explorer")

    # 测试内容：模板相关 agentTaskType 已从 python runtime 移除。
    def test_resolve_agent_task_runtime_rejects_template(self) -> None:
        with self.assertRaisesRegex(ValueError, "Unknown agent_task_type: template"):
            resolve_agent_task_runtime("template")

    # 测试内容：PPT prompt 链路已从 python runtime 移除。
    def test_resolve_agent_task_runtime_rejects_pptprompt(self) -> None:
        with self.assertRaisesRegex(ValueError, "Unknown agent_task_type: pptprompt"):
            resolve_agent_task_runtime("pptprompt")


if __name__ == "__main__":
    unittest.main()
