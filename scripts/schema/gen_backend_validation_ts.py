#!/usr/bin/env python3
# 该文件职责：从 backend OpenAPI 生成前端运行时响应校验映射（endpoint -> response schema）。

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


HTTP_METHODS = ("get", "post", "put", "patch", "delete")


def _strip_api_prefix(path: str) -> str:
    if path == "/api":
        return "/"
    if path.startswith("/api/"):
        return path[4:]
    return path


def _extract_module_from_normalized_path(path: str) -> str:
    segs = [seg for seg in path.split("/") if seg]
    if not segs:
        return "root"
    return segs[0]


def _pick_response_schema(operation: dict[str, Any]) -> dict[str, Any] | None:
    responses = operation.get("responses")
    if not isinstance(responses, dict):
        return None

    def key_rank(key: str) -> tuple[int, str]:
        if key.startswith("2"):
            return (0, key)
        if key == "default":
            return (1, key)
        return (2, key)

    for key in sorted(responses.keys(), key=key_rank):
        if not (key.startswith("2") or key == "default"):
            continue
        response = responses.get(key)
        if not isinstance(response, dict):
            continue
        content = response.get("content")
        if not isinstance(content, dict):
            continue
        for media_type in ("application/json", "*/*"):
            media = content.get(media_type)
            if not isinstance(media, dict):
                continue
            schema = media.get("schema")
            if isinstance(schema, dict):
                return schema
        for media in content.values():
            if isinstance(media, dict) and isinstance(media.get("schema"), dict):
                return media["schema"]
    return None


def _normalize_nullable(schema: Any) -> Any:
    if isinstance(schema, list):
        return [_normalize_nullable(item) for item in schema]
    if not isinstance(schema, dict):
        return schema

    normalized = {key: _normalize_nullable(value) for key, value in schema.items()}

    nullable = normalized.pop("nullable", None)
    schema_type = normalized.get("type")
    if nullable is True:
        if isinstance(schema_type, str):
            normalized["type"] = [schema_type, "null"]
        elif isinstance(schema_type, list):
            if "null" not in schema_type:
                normalized["type"] = [*schema_type, "null"]
        elif "oneOf" in normalized and isinstance(normalized["oneOf"], list):
            has_null = any(isinstance(item, dict) and item.get("type") == "null" for item in normalized["oneOf"])
            if not has_null:
                normalized["oneOf"] = [*normalized["oneOf"], {"type": "null"}]

    # OpenAPI 中非 required 字段在该项目后端语义上可能返回 null，这里做运行时校验兼容。
    if normalized.get("type") == "object":
        additional_properties = normalized.get("additionalProperties")
        if isinstance(additional_properties, dict):
            # Springdoc 对 Map<String, Object> 可能生成为 additionalProperties.type=object，
            # 但该项目实际语义为 value 可为任意 JSON 类型，这里统一放宽为 true 以避免误报。
            ap_type = additional_properties.get("type")
            if (
                ap_type == "object"
                and len(additional_properties) == 1
            ):
                normalized["additionalProperties"] = True

        properties = normalized.get("properties")
        if isinstance(properties, dict):
            required = normalized.get("required")
            required_set = set(required) if isinstance(required, list) else set()
            for prop_name, prop_schema in list(properties.items()):
                if prop_name in required_set or not isinstance(prop_schema, dict):
                    continue
                prop_type = prop_schema.get("type")
                if isinstance(prop_type, str):
                    if prop_type != "null":
                        prop_schema["type"] = [prop_type, "null"]
                elif isinstance(prop_type, list):
                    if "null" not in prop_type:
                        prop_schema["type"] = [*prop_type, "null"]

    return normalized


def _generate(schema: dict[str, Any]) -> dict[str, Any]:
    components = schema.get("components")
    component_schemas = {}
    if isinstance(components, dict):
        schemas = components.get("schemas")
        if isinstance(schemas, dict):
            component_schemas = _normalize_nullable(schemas)

    entries: list[dict[str, Any]] = []
    paths = schema.get("paths")
    if isinstance(paths, dict):
        for path, path_item in paths.items():
            if not isinstance(path_item, dict):
                continue
            normalized_path = _strip_api_prefix(path)
            for method in HTTP_METHODS:
                operation = path_item.get(method)
                if not isinstance(operation, dict):
                    continue
                response_schema = _pick_response_schema(operation)
                if response_schema is None:
                    continue
                entries.append(
                    {
                        "module": _extract_module_from_normalized_path(normalized_path),
                        "method": method.upper(),
                        "path": normalized_path,
                        "operationId": operation.get("operationId", ""),
                        "responseSchema": _normalize_nullable(response_schema),
                    }
                )
    entries_by_module: dict[str, list[dict[str, Any]]] = {}
    for entry in entries:
        entries_by_module.setdefault(entry["module"], []).append(entry)
    return {"componentSchemas": component_schemas, "entries": entries, "entriesByModule": entries_by_module}


def _write_if_changed(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and path.read_text(encoding="utf-8") == content:
        return
    path.write_text(content, encoding="utf-8")


def _render_ts(payload: dict[str, Any], banner: str) -> str:
    lines = [banner, ""]
    lines.append(
        "export interface BackendEndpointValidationEntry {"
        "\n  module: string;"
        "\n  method: string;"
        "\n  path: string;"
        "\n  operationId: string;"
        "\n  responseSchema: unknown;"
        "\n}"
    )
    lines.append("")
    lines.append("export const BACKEND_COMPONENT_SCHEMAS = " + json.dumps(payload["componentSchemas"], ensure_ascii=False, indent=2) + ";")
    lines.append("")
    lines.append(
        "export const BACKEND_ENDPOINT_VALIDATION_BY_MODULE: Record<string, BackendEndpointValidationEntry[]> = "
        + json.dumps(payload["entriesByModule"], ensure_ascii=False, indent=2)
        + ";"
    )
    lines.append("")
    lines.append(
        "export const BACKEND_ENDPOINT_VALIDATION: BackendEndpointValidationEntry[] = "
        + json.dumps(payload["entries"], ensure_ascii=False, indent=2)
        + ";"
    )
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--schema", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--banner", required=True)
    args = parser.parse_args()

    source = json.loads(args.schema.read_text(encoding="utf-8"))
    payload = _generate(source)
    content = _render_ts(payload, args.banner)
    _write_if_changed(args.out, content)
    print(f"generated {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
