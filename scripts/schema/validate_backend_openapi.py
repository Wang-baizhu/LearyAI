#!/usr/bin/env python3
# 该文件职责：校验 backend OpenAPI 是否满足模块路径、控制器标签及模块拆分产物对齐规则。

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


HTTP_METHODS = {"get", "post", "put", "patch", "delete"}
ALLOWED_NON_API_PATHS = {
    "/sse/tasks": {"task-sse-controller"},
}
MODULE_TAGS = {
    "admin": {"admin-controller"},
    "auth": {"auth-controller", "sms-code-controller"},
    "kb": {"kb-doc-controller"},
    "skills": {"kb-skill-token-controller", "visit-controller"},
    "knowledge-bases": {"knowledge-base-controller"},
    "market": {"market-controller"},
    "projects": {"project-controller"},
    "resource-center": {"resource-center-controller"},
    "tasks": {"task-controller"},
    "templates": {"template-controller", "template-internal-controller"},
    "usage": {"usage-controller"},
    "visits": {"visit-controller"},
}


def _load(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise RuntimeError(f"schema 不是 JSON object: {path}")
    return data


def _iter_component_refs(node: Any) -> list[tuple[str, str]]:
    refs: list[tuple[str, str]] = []

    def walk(value: Any) -> None:
        if isinstance(value, dict):
            ref = value.get("$ref")
            if isinstance(ref, str) and ref.startswith("#/components/"):
                parts = ref.split("/")
                if len(parts) >= 4:
                    refs.append((parts[2], parts[3]))
            for item in value.values():
                walk(item)
            return
        if isinstance(value, list):
            for item in value:
                walk(item)

    walk(node)
    return refs


def _validate_component_ref_integrity(data: dict, label: str) -> list[str]:
    errors: list[str] = []
    components = data.get("components")
    components_dict = components if isinstance(components, dict) else {}
    for section, name in _iter_component_refs(data):
        section_obj = components_dict.get(section)
        if not isinstance(section_obj, dict) or name not in section_obj:
            errors.append(f"{label}: 缺少组件引用目标 #/components/{section}/{name}")
    return errors


def _validate(data: dict) -> list[str]:
    errors: list[str] = []
    paths = data.get("paths")
    if not isinstance(paths, dict):
        return ["openapi.paths 缺失或不是 object"]

    op_ids: dict[str, str] = {}
    for path, item in paths.items():
        if not isinstance(item, dict):
            errors.append(f"{path}: path item 不是 object")
            continue

        path_module = None
        if path.startswith("/api/"):
            segs = path.split("/")
            if len(segs) < 3 or not segs[2]:
                errors.append(f"{path}: 缺少模块段（应为 /api/{{module}}/...）")
                continue
            path_module = segs[2]
            if path_module not in MODULE_TAGS:
                errors.append(f"{path}: 未在模块白名单中定义（{path_module}）")
        else:
            if path not in ALLOWED_NON_API_PATHS:
                errors.append(f"{path}: 非 /api 路径且不在白名单")

        for method, op in item.items():
            if method.lower() not in HTTP_METHODS:
                continue
            if not isinstance(op, dict):
                errors.append(f"{path} [{method}]: operation 不是 object")
                continue

            op_id = op.get("operationId")
            if not isinstance(op_id, str) or not op_id:
                errors.append(f"{path} [{method}]: 缺少 operationId")
            else:
                prev = op_ids.get(op_id)
                current = f"{method.upper()} {path}"
                if prev is not None and prev != current:
                    errors.append(f"operationId 重复: {op_id} ({prev} vs {current})")
                else:
                    op_ids[op_id] = current

            tags = op.get("tags")
            if not isinstance(tags, list) or not tags:
                errors.append(f"{path} [{method}]: 缺少 tags")
                continue
            tag_values = {str(v) for v in tags}

            expected = MODULE_TAGS.get(path_module) if path_module else ALLOWED_NON_API_PATHS.get(path)
            if expected is None:
                continue
            if tag_values.isdisjoint(expected):
                errors.append(
                    f"{path} [{method}]: tags={sorted(tag_values)} 与模块期望标签 {sorted(expected)} 不匹配"
                )

    errors.extend(_validate_component_ref_integrity(data, "full-openapi"))
    return errors


def _collect_full_paths_by_module(data: dict) -> dict[str, set[str]]:
    result: dict[str, set[str]] = {}
    paths = data.get("paths")
    if not isinstance(paths, dict):
        return result
    for path, path_item in paths.items():
        if not isinstance(path_item, dict):
            continue
        if not path.startswith("/api/"):
            continue
        segs = path.split("/")
        if len(segs) < 3 or not segs[2]:
            continue
        result.setdefault(segs[2], set()).add(path)
    return result


def _validate_module_doc(module: str, module_doc: dict) -> list[str]:
    errors: list[str] = []
    paths = module_doc.get("paths")
    if not isinstance(paths, dict):
        return [f"{module}.openapi.json: paths 缺失或不是 object"]
    for path in paths.keys():
        if not (path == f"/api/{module}" or path.startswith(f"/api/{module}/")):
            errors.append(f"{module}.openapi.json: 包含非本模块路径 {path}")
    errors.extend(_validate_component_ref_integrity(module_doc, f"{module}.openapi.json"))
    return errors


def _validate_module_alignment(data: dict, modules_dir: Path) -> list[str]:
    errors: list[str] = []
    full_paths_by_module = _collect_full_paths_by_module(data)
    if not modules_dir.exists():
        return [f"modules 目录不存在: {modules_dir}"]

    for module, full_paths in sorted(full_paths_by_module.items()):
        module_file = modules_dir / f"{module}.openapi.json"
        if not module_file.exists():
            errors.append(f"缺少模块 openapi 文件: {module_file}")
            continue
        module_doc = _load(module_file)
        errors.extend(_validate_module_doc(module, module_doc))
        module_paths = module_doc.get("paths")
        module_path_set = set(module_paths.keys()) if isinstance(module_paths, dict) else set()
        if module_path_set != full_paths:
            errors.append(
                f"{module}.openapi.json: paths 与全量 openapi 不一致，expect={sorted(full_paths)} actual={sorted(module_path_set)}"
            )

    for file in sorted(modules_dir.glob("*.openapi.json")):
        module_name = file.name.removesuffix(".openapi.json")
        if module_name not in full_paths_by_module:
            errors.append(f"{file}: 在全量 openapi 中不存在该模块")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--schema", type=Path, required=True)
    parser.add_argument("--modules-dir", type=Path, required=False)
    args = parser.parse_args()

    data = _load(args.schema)
    errors = _validate(data)
    if args.modules_dir is not None:
        errors.extend(_validate_module_alignment(data, args.modules_dir))
    if errors:
        print("backend openapi 模块对齐校验失败：")
        for err in errors:
            print(f"- {err}")
        return 1
    if args.modules_dir is None:
        print(f"backend openapi 模块对齐校验通过：{args.schema}")
    else:
        print(f"backend openapi 模块对齐校验通过：{args.schema} + {args.modules_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
