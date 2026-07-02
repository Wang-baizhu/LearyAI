# Responsibilities: render registered flow graphs with task-scoped template variables.

from __future__ import annotations

import re
from dataclasses import replace

from kimi_cli.skill.flow import Flow, FlowEdge, FlowNode

_PLACEHOLDER_RE = re.compile(r"\$\{([A-Za-z0-9_]+)\}")


class FlowRenderError(ValueError):
    """Raised when flow template variables are invalid or cannot be rendered."""


def collect_flow_placeholders(flow: Flow) -> set[str]:
    placeholders: set[str] = set()
    for node in flow.nodes.values():
        if not isinstance(node.label, str):
            continue
        placeholders.update(_PLACEHOLDER_RE.findall(node.label))
    return placeholders


def render_flow_label(label: str, flow_vars: dict[str, str]) -> str:
    def _replace(match: re.Match[str]) -> str:
        key = match.group(1)
        if key not in flow_vars:
            raise FlowRenderError(f"missing flow variable: {key}")
        return flow_vars[key]

    return _PLACEHOLDER_RE.sub(_replace, label)


def render_flow(flow: Flow, flow_vars: dict[str, str] | None = None) -> Flow:
    normalized_vars = dict(flow_vars or {})
    placeholders = collect_flow_placeholders(flow)
    extra_keys = set(normalized_vars) - placeholders
    if extra_keys:
        unknown = ", ".join(sorted(extra_keys))
        raise FlowRenderError(f"unknown flow variables: {unknown}")
    missing_keys = placeholders - set(normalized_vars)
    if missing_keys:
        missing = ", ".join(sorted(missing_keys))
        raise FlowRenderError(f"missing flow variables: {missing}")

    nodes: dict[str, FlowNode] = {}
    for node_id, node in flow.nodes.items():
        if isinstance(node.label, str):
            nodes[node_id] = replace(node, label=render_flow_label(node.label, normalized_vars))
            continue
        if placeholders:
            raise FlowRenderError(f"flow node label must be string when using variables: {node.id}")
        nodes[node_id] = replace(node, label=list(node.label))
    outgoing = {
        node_id: [replace(edge) for edge in edges]
        for node_id, edges in flow.outgoing.items()
    }
    return Flow(
        nodes=nodes,
        outgoing=outgoing,
        begin_id=flow.begin_id,
        end_id=flow.end_id,
    )
