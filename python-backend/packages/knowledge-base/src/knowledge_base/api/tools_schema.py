# 该文件职责：提供 RAG 工具的 OpenAI tools JSON Schema 描述。

from __future__ import annotations

from typing import Dict, List


def _doc_info_node_schema_ref() -> Dict[str, object]:
    return {"$ref": "#/$defs/doc_info_node"}


def _doc_info_node_schema_definition() -> Dict[str, object]:
    return {
        "type": "object",
        "properties": {
            "id": {
                "type": "string",
                "description": "当前目录树内稳定的节点 id。",
            },
            "title": {
                "type": "string",
                "description": "目录节点标题。",
            },
            "summary": {
                "type": "string",
                "description": "节点摘要，不能为空。",
            },
            "page_start": {
                "type": "integer",
                "description": "起始页码。",
            },
            "page_end": {
                "type": "integer",
                "description": "结束页码。",
            },
            "children": {
                "type": "array",
                "items": _doc_info_node_schema_ref(),
                "description": "直接子节点列表；没有子节点时传空数组。",
            },
        },
        "required": ["id", "title", "summary", "page_start", "page_end"],
    }


def get_tools() -> List[Dict[str, object]]:
    return [
        {
            "type": "function",
            "function": {
                "name": "rag_search",
                "description": "基于向量或混合检索返回相关文本片段。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "检索问题或关键词。",
                        },
                        "doc_ids": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "文档 ID 过滤列表。",
                        },
                    },
                    "required": ["query"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "rag_fetch",
                "description": "根据 doc_ids 与 page_nums 批量获取原文片段。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "doc_ids": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "文档 ID 列表。",
                        },
                        "page_nums": {
                            "type": "array",
                            "items": {"type": "integer"},
                            "description": "页号列表。",
                        },
                        "store_keys": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "可选的语言分表路由键列表，例如 zh、en。",
                        },
                    },
                    "required": ["doc_ids", "page_nums"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_doc_info",
                "description": "获取指定 doc_id 的 instructions 拼接文本。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "doc_id": {
                            "type": "string",
                            "description": "文档业务 docId(UUID)。",
                        },
                        "node_id": {
                            "type": "string",
                            "description": "可选的目录节点 id；传入后查看当前节点与下一层。",
                        },
                    },
                    "required": ["doc_id"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "update_doc_info",
                "description": "更新指定 doc_id 的结构化文档目录与元数据并返回是否成功。",
                "parameters": {
                    "type": "object",
                    "$defs": {
                        "doc_info_node": _doc_info_node_schema_definition(),
                    },
                    "properties": {
                        "doc_id": {
                            "type": "string",
                            "description": "文档业务 docId(UUID)。",
                        },
                        "tag": {
                            "type": "string",
                            "description": "标签。",
                        },
                        "description": {
                            "type": "string",
                            "description": "文档概要。",
                        },
                        "parent_node_id": {
                            "type": "string",
                            "description": "可选父节点 id；为空时覆盖根级 nodes。",
                        },
                        "nodes": {
                            "type": "array",
                            "items": _doc_info_node_schema_ref(),
                            "description": "要覆盖写入的一层目录节点列表。直接传数组对象，不要再次编码成 JSON 字符串。",
                        },
                        "name": {
                            "type": "string",
                            "description": "文档名称（写入 kb_doc.name 列）。",
                        },
                    },
                    "required": ["doc_id"],
                },
            },
        },
    ]
