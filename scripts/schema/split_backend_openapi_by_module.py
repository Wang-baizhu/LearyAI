#!/usr/bin/env python3
# 该文件职责：把 backend 全量 OpenAPI 按 /api/{module} 路径拆分为模块级 OpenAPI 文件。

from __future__ import annotations

import argparse
import json
from collections import deque
from pathlib import Path
from typing import Any


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


def _collect_component_subset(source: dict[str, Any], module_paths: dict[str, Any]) -> dict[str, Any]:
    source_components = source.get("components")
    if not isinstance(source_components, dict):
        return {}

    selected: dict[str, set[str]] = {}
    queue: deque[tuple[str, str]] = deque(_iter_component_refs(module_paths))

    while queue:
        section, name = queue.popleft()
        names = selected.setdefault(section, set())
        if name in names:
            continue
        section_obj = source_components.get(section)
        if not isinstance(section_obj, dict):
            continue
        component_obj = section_obj.get(name)
        if not isinstance(component_obj, dict):
            continue
        names.add(name)
        for ref in _iter_component_refs(component_obj):
            queue.append(ref)

    subset: dict[str, Any] = {}
    for section, names in sorted(selected.items()):
        section_obj = source_components.get(section)
        if not isinstance(section_obj, dict):
            continue
        picked = {name: section_obj[name] for name in sorted(names) if name in section_obj}
        if picked:
            subset[section] = picked
    return subset


def _paths_by_module(paths: dict[str, Any]) -> dict[str, dict[str, Any]]:
    grouped: dict[str, dict[str, Any]] = {}
    for path, path_item in paths.items():
        if not isinstance(path_item, dict):
            continue
        if not path.startswith("/api/"):
            continue
        parts = path.split("/")
        if len(parts) < 3 or not parts[2]:
            continue
        module = parts[2]
        grouped.setdefault(module, {})[path] = path_item
    return grouped


def _render_module_doc(source: dict[str, Any], module_paths: dict[str, Any]) -> dict[str, Any]:
    output: dict[str, Any] = {}
    for key in (
        "openapi",
        "info",
        "jsonSchemaDialect",
        "servers",
        "security",
        "externalDocs",
    ):
        if key in source:
            output[key] = source[key]

    used_tags: set[str] = set()
    for path_item in module_paths.values():
        if not isinstance(path_item, dict):
            continue
        for operation in path_item.values():
            if not isinstance(operation, dict):
                continue
            tags = operation.get("tags")
            if isinstance(tags, list):
                used_tags.update(str(tag) for tag in tags if tag)

    source_tags = source.get("tags")
    if isinstance(source_tags, list):
        filtered_tags = [tag for tag in source_tags if isinstance(tag, dict) and tag.get("name") in used_tags]
        if filtered_tags:
            output["tags"] = filtered_tags

    output["paths"] = {path: module_paths[path] for path in sorted(module_paths)}
    component_subset = _collect_component_subset(source, output["paths"])
    if component_subset:
        output["components"] = component_subset
    return output


def _write_if_changed(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and path.read_text(encoding="utf-8") == content:
        return
    path.write_text(content, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--schema", type=Path, required=True)
    parser.add_argument("--out-dir", type=Path, required=True)
    args = parser.parse_args()

    source = json.loads(args.schema.read_text(encoding="utf-8"))
    paths = source.get("paths")
    if not isinstance(paths, dict):
        raise RuntimeError("openapi.paths 缺失或不是 object")

    modules = _paths_by_module(paths)
    args.out_dir.mkdir(parents=True, exist_ok=True)

    current_targets = {f"{module}.openapi.json" for module in modules}
    for stale_file in args.out_dir.glob("*.openapi.json"):
        if stale_file.name in current_targets:
            continue
        stale_file.unlink()

    manifest: dict[str, list[str]] = {}
    for module, module_paths in sorted(modules.items()):
        module_doc = _render_module_doc(source, module_paths)
        content = json.dumps(module_doc, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
        target = args.out_dir / f"{module}.openapi.json"
        _write_if_changed(target, content)
        manifest[module] = sorted(module_paths.keys())
        print(f"generated {target}")

    manifest_target = args.out_dir / "modules.json"
    _write_if_changed(
        manifest_target,
        json.dumps({"modules": sorted(manifest.keys()), "pathsByModule": manifest}, ensure_ascii=False, indent=2, sort_keys=True)
        + "\n",
    )
    print(f"generated {manifest_target}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
