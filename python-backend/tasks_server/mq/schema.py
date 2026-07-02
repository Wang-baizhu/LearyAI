# Responsibilities: parse and validate MQ agent command messages from shared JSON schema.

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError as JsonSchemaValidationError
from pydantic import ValidationError

from tasks_server.mq.generated_contracts import (
    AgentRunCommand,
)

AGENT_TASK_TYPES = {"template", "kbsummary", "kbview", "search", "pptprompt"}
FLOW_AGENT_TASK_TYPES = {"template", "kbsummary", "kbview", "search", "pptprompt"}
AGENT_TASK_TYPE_STAGE_RUN_KEYS = {
    "template": "agent:template:",
    "kbsummary": "agent:summary",
    "kbview": "agent:kbview",
    "search": "agent:search",
    "pptprompt": "agent:pptprompt",
}


class PayloadError(ValueError):
    pass


def parse_payload(body: bytes) -> dict[str, Any]:
    try:
        return json.loads(body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise PayloadError("invalid json payload") from exc


def parse_task_payload(raw: dict[str, Any]) -> AgentRunCommand:
    payload = raw.get("payload")
    if not isinstance(payload, dict):
        raise PayloadError("payload required")
    _validate_semantics(raw, payload)
    _validate_against_schema(raw)
    try:
        command = AgentRunCommand.model_validate(raw)
    except ValidationError as exc:
        raise PayloadError(_normalize_validation_error(exc)) from exc
    return command.model_copy(update={"raw": raw})


def _normalize_validation_error(exc: ValidationError) -> str:
    issue = exc.errors()[0]
    location = ".".join(str(part) for part in issue.get("loc", ()))
    message = str(issue.get("msg", "payload invalid"))
    if location.endswith("payload.agentTaskType"):
        return "payload.agentTaskType required"
    if location.endswith("taskType"):
        return "taskType must be agent"
    if location.endswith("taskRecordId"):
        return "taskRecordId required"
    if location.endswith("projectId"):
        return "projectId required"
    if location.endswith("messageId"):
        return "messageId required"
    if location.endswith("kbId"):
        return "kbId required"
    if location.endswith("payload.promptVars"):
        return "payload.promptVars invalid"
    if location.endswith("stageRunKey"):
        return "stageRunKey required"
    return f"{location} {message}".strip()


def _validate_semantics(raw: dict[str, Any], payload: dict[str, Any]) -> None:
    agent_task_type = _require_non_empty_text(payload, "agentTaskType", "payload.agentTaskType required")
    _require_non_empty_text(raw, "messageId", "messageId required")
    _validate_scope(raw, agent_task_type)
    _require_int(raw, "taskRecordId", "taskRecordId required")
    _require_non_empty_text(raw, "occurredAt", "occurredAt required")
    _require_non_empty_text(raw, "traceId", "traceId required")

    if raw.get("schemaVersion") != "1.0":
        raise PayloadError("schemaVersion must be 1.0")
    if raw.get("producer") != "backend":
        raise PayloadError("producer must be backend")
    if raw.get("taskType") != "agent":
        raise PayloadError("taskType must be agent")

    stage_run_key = _require_non_empty_text(raw, "stageRunKey", "stageRunKey required")
    if agent_task_type not in AGENT_TASK_TYPES:
        raise PayloadError("payload.agentTaskType invalid")
    _validate_stage_run_key(stage_run_key, agent_task_type, payload)

    _validate_doc_refs(payload.get("docRefs"))
    _validate_extra_info(payload.get("extraInfo"))
    if agent_task_type in FLOW_AGENT_TASK_TYPES:
        _validate_prompt_vars(payload.get("promptVars"))
    if agent_task_type == "template":
        _require_non_empty_text(payload, "pluginId", "payload.pluginId required")


def _validate_scope(raw: dict[str, Any], agent_task_type: str) -> None:
    project_id = raw.get("projectId")
    kb_id = raw.get("kbId")
    if agent_task_type == "pptprompt":
        if project_id is not None and (not isinstance(project_id, str) or not project_id.strip()):
            raise PayloadError("projectId required")
        if kb_id is not None and (not isinstance(kb_id, str) or not kb_id.strip()):
            raise PayloadError("kbId required")
        return
    _require_non_empty_text(raw, "projectId", "projectId required")
    _require_non_empty_text(raw, "kbId", "kbId required")


def _validate_stage_run_key(stage_run_key: str, agent_task_type: str, payload: dict[str, Any]) -> None:
    if agent_task_type == "template":
        plugin_id = _require_non_empty_text(payload, "pluginId", "payload.pluginId required")
        if stage_run_key != f"{AGENT_TASK_TYPE_STAGE_RUN_KEYS['template']}{plugin_id}":
            raise PayloadError("stageRunKey invalid")
        return
    expected_stage_run_key = AGENT_TASK_TYPE_STAGE_RUN_KEYS.get(agent_task_type)
    if expected_stage_run_key != stage_run_key:
        raise PayloadError("stageRunKey invalid")


def _require_non_empty_text(container: dict[str, Any], key: str, message: str) -> str:
    value = container.get(key)
    if not isinstance(value, str) or not value.strip():
        raise PayloadError(message)
    return value


def _require_int(container: dict[str, Any], key: str, message: str) -> int:
    value = container.get(key)
    if not isinstance(value, int):
        raise PayloadError(message)
    return value


def _validate_doc_refs(value: Any) -> None:
    if value is None:
        return
    if not isinstance(value, list):
        raise PayloadError("payload invalid")
    for item in value:
        if not isinstance(item, dict):
            raise PayloadError("payload invalid")
        ref_id = item.get("id")
        if not isinstance(ref_id, str) or not ref_id.strip():
            raise PayloadError("payload.docRefs invalid")


def _validate_prompt_vars(value: Any) -> None:
    if value is None:
        return
    if not isinstance(value, dict):
        raise PayloadError("payload.promptVars invalid")
    for key, item in value.items():
        if not isinstance(key, str) or not isinstance(item, str):
            raise PayloadError("payload.promptVars invalid")


def _validate_extra_info(value: Any) -> None:
    if value is None:
        return
    if not isinstance(value, str):
        raise PayloadError("payload.extraInfo invalid")


def _validate_against_schema(raw: dict[str, Any]) -> None:
    try:
        Draft202012Validator(_agent_run_schema()).validate(raw)
    except JsonSchemaValidationError as exc:
        path = ".".join(str(part) for part in exc.absolute_path)
        if path.endswith("promptVars") or "promptVars" in exc.message:
            raise PayloadError("payload.promptVars invalid") from exc
        if path.endswith("agentTaskType") or "agentTaskType" in exc.message:
            raise PayloadError("payload.agentTaskType required") from exc
        if path.endswith("pluginId") or "pluginId" in exc.message:
            raise PayloadError("payload.pluginId required") from exc
        if path.endswith("taskType") or "taskType" in exc.message:
            raise PayloadError("taskType must be agent") from exc
        if path.endswith("taskRecordId") or "taskRecordId" in exc.message:
            raise PayloadError("taskRecordId required") from exc
        if path.endswith("projectId") or "projectId" in exc.message:
            raise PayloadError("projectId required") from exc
        if path.endswith("messageId") or "messageId" in exc.message:
            raise PayloadError("messageId required") from exc
        if path.endswith("kbId") or "kbId" in exc.message:
            raise PayloadError("kbId required") from exc
        if path.endswith("stageRunKey") or "stageRunKey" in exc.message:
            raise PayloadError("stageRunKey required") from exc
        raise PayloadError("payload invalid") from exc


@lru_cache(maxsize=1)
def _agent_run_schema() -> dict[str, Any]:
    schema_path = Path(__file__).resolve().parents[3] / "schema" / "task" / "task.command.agent.run.schema.json"
    return json.loads(schema_path.read_text(encoding="utf-8"))
