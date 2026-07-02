# Responsibilities: provide helper functions around generated task command contracts.

from __future__ import annotations

from tasks_server.mq.generated_contracts import AgentRunCommand


def agent_task_type_of(command: AgentRunCommand) -> str:
    return (command.payload.agent_task_type or "").strip().lower()
