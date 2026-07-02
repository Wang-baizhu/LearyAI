#!/usr/bin/env python3
# 该文件职责：从 task.command.agent.run JSON Schema 生成 tasks_server 使用的 Pydantic 强类型。

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any


def _snake_case(name: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower().replace("(", "_").replace(")", "_")


def _write_if_changed(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and path.read_text(encoding="utf-8") == content:
        return
    path.write_text(content, encoding="utf-8")


def _load_schema(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _resolve_ref(variant: dict[str, Any], ref: str) -> tuple[str, dict[str, Any]]:
    if not ref.startswith("#/$defs/"):
        raise ValueError(f"unsupported ref: {ref}")
    name = ref.removeprefix("#/$defs/")
    defs = variant.get("$defs")
    if not isinstance(defs, dict) or name not in defs:
        raise ValueError(f"missing schema def: {name}")
    return name, defs[name]


def _field_type(class_name: str, field_name: str, schema: dict[str, Any], variant: dict[str, Any]) -> str:
    ref = schema.get("$ref")
    if isinstance(ref, str):
        ref_name, ref_schema = _resolve_ref(variant, ref)
        if ref_name.isidentifier():
            return ref_name
        return _field_type(class_name, field_name, ref_schema, variant)
    schema_type = schema.get("type")
    if schema_type == "string":
        enum_values = schema.get("enum")
        if isinstance(enum_values, list) and enum_values:
            literals = ", ".join(repr(value) for value in enum_values)
            return f"Literal[{literals}]"
        return "str"
    if schema_type == "integer":
        return "int"
    if schema_type == "array":
        items = schema.get("items")
        if isinstance(items, dict) and items:
            return f"list[{_field_type(class_name, field_name, items, variant)}]"
        return "list[Any]"
    if schema_type == "object":
        additional = schema.get("additionalProperties")
        if isinstance(additional, dict):
            return f"dict[str, {_field_type(class_name, field_name, additional, variant)}]"
        return "dict[str, Any]"
    return "Any"


def _field_definition(class_name: str, field_name: str, schema: dict[str, Any], variant: dict[str, Any]) -> str:
    annotation = _field_type(class_name, field_name, schema, variant)
    alias = field_name
    python_name = _snake_case(field_name)
    required_fields = schema.get("required")
    required = isinstance(required_fields, list) and field_name in required_fields
    is_array = annotation.startswith("list[")
    is_map = annotation.startswith("dict[")

    if required:
        if python_name == alias:
            return f"    {python_name}: {annotation}"
        return f'    {python_name}: {annotation} = Field(alias="{alias}")'

    if is_array:
        return f'    {python_name}: {annotation} = Field(default_factory=list, alias="{alias}")'
    if is_map:
        return f'    {python_name}: {annotation} = Field(default_factory=dict, alias="{alias}")'
    return f'    {python_name}: {annotation} | None = Field(default=None, alias="{alias}")'


def _emit_class(class_name: str, schema: dict[str, Any], variant: dict[str, Any], *, include_raw: bool = False) -> str:
    lines = [f"class {class_name}(_Model):"]
    properties = schema.get("properties")
    if isinstance(properties, dict):
        for field_name, field_schema in properties.items():
            if not isinstance(field_schema, dict):
                continue
            lines.append(_field_definition(class_name, field_name, field_schema, variant))
    if include_raw:
        lines.append('    raw: dict[str, Any] = Field(default_factory=dict, exclude=True)')
    if len(lines) == 1:
        lines.append("    pass")
    return "\n".join(lines)


def _render(schema: dict[str, Any]) -> str:
    defs = schema.get("$defs", {})
    if not isinstance(defs, dict):
        raise ValueError("invalid task schema defs")

    parts = [
        "# Responsibilities: generated task.command.agent.run Pydantic contracts from JSON Schema.",
        "",
        "from __future__ import annotations",
        "",
        "from typing import Any, Literal, TypeAlias",
        "",
        "from pydantic import BaseModel, ConfigDict, Field",
        "",
        "",
        "class _Model(BaseModel):",
        '    model_config = ConfigDict(extra="forbid", populate_by_name=True)',
        "",
        _emit_class("TaskDocRef", defs["TaskDocRef"], schema),
        "",
        _emit_class("AgentPayload", defs["AgentPayload"], schema),
        "",
        _emit_class("AgentRunCommand", schema, schema, include_raw=True),
        "",
        "GeneratedAgentRunCommand: TypeAlias = AgentRunCommand",
        "",
    ]
    return "\n".join(parts)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--schema", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()

    schema = _load_schema(args.schema)
    _write_if_changed(args.out, _render(schema) + "\n")
    print(f"generated {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
