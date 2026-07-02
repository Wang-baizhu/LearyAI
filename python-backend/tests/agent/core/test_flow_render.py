from __future__ import annotations

import pytest
from kosong.message import TextPart

from kimi_cli.skill.flow import Flow, FlowEdge, FlowNode
from kimi_cli.soul.flow_render import FlowRenderError, collect_flow_placeholders, render_flow


def _build_flow(label: str | list[TextPart]) -> Flow:
    nodes = {
        "BEGIN": FlowNode(id="BEGIN", label="BEGIN", kind="begin"),
        "TASK": FlowNode(id="TASK", label=label, kind="task"),
        "END": FlowNode(id="END", label="END", kind="end"),
    }
    outgoing = {
        "BEGIN": [FlowEdge(src="BEGIN", dst="TASK", label=None)],
        "TASK": [FlowEdge(src="TASK", dst="END", label=None)],
        "END": [],
    }
    return Flow(nodes=nodes, outgoing=outgoing, begin_id="BEGIN", end_id="END")


def test_collect_flow_placeholders() -> None:
    flow = _build_flow("请围绕 ${focus} 生成，受众是 ${audience}")

    assert collect_flow_placeholders(flow) == {"focus", "audience"}


def test_render_flow_replaces_labels_without_mutating_source() -> None:
    flow = _build_flow("请围绕 ${focus} 生成")

    rendered = render_flow(flow, {"focus": "第二章"})

    assert rendered.nodes["TASK"].label == "请围绕 第二章 生成"
    assert flow.nodes["TASK"].label == "请围绕 ${focus} 生成"


def test_render_flow_rejects_missing_variable() -> None:
    flow = _build_flow("请围绕 ${focus} 生成")

    with pytest.raises(FlowRenderError, match="missing flow variables: focus"):
        render_flow(flow, {})


def test_render_flow_rejects_unknown_variable() -> None:
    flow = _build_flow("请围绕 ${focus} 生成")

    with pytest.raises(FlowRenderError, match="unknown flow variables: extra"):
        render_flow(flow, {"focus": "第二章", "extra": "x"})


def test_render_flow_rejects_non_string_label_when_using_variables() -> None:
    flow = _build_flow([TextPart(text="请围绕 ${focus} 生成")])

    with pytest.raises(FlowRenderError, match="unknown flow variables: focus"):
        render_flow(flow, {"focus": "第二章"})
