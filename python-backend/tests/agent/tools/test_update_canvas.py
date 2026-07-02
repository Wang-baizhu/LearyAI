"""Tests for knowledge-base canvas replace behavior."""

from __future__ import annotations

from kimi_cli.tools.kb.update_canvas import _normalize_canvas


def test_normalize_canvas_keeps_only_current_generated_graph() -> None:
    generated_canvas = {
        "version": 1,
        "nodes": [
            {
                "id": "topic:alpha",
                "type": "resizable",
                "position": {"x": 280, "y": 120},
                "data": {"label": "主题 A"},
            },
            {
                "id": "topic:beta",
                "type": "resizable",
                "data": {"label": "主题 B"},
            },
        ],
        "edges": [
            {
                "id": "edge-topic-topic",
                "source": "topic:alpha",
                "target": "topic:beta",
                "label": "关联",
            }
        ],
        "viewport": {"x": 10, "y": 20, "zoom": 1.1},
    }

    normalized = _normalize_canvas(generated_canvas)

    assert {node["id"] for node in normalized["nodes"]} == {"topic:alpha", "topic:beta"}
    assert {edge["id"] for edge in normalized["edges"]} == {"edge-topic-topic"}
    assert normalized["viewport"] == {"x": 10, "y": 20, "zoom": 1.1}


def test_normalize_canvas_sets_default_version_when_missing() -> None:
    normalized = _normalize_canvas(
        {
            "nodes": [
                {
                    "id": "kbdoc:doc-1",
                    "type": "resizable",
                    "data": {"label": "文档 1"},
                }
            ],
            "edges": [],
        }
    )

    assert normalized["version"] == 1
