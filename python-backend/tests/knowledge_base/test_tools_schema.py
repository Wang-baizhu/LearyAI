# 该文件职责：验证 knowledge_base tools schema 的关键参数契约，避免工具参数缺失。

from __future__ import annotations

import unittest

from knowledge_base.api.tools_schema import get_tools


class ToolsSchemaTests(unittest.TestCase):
    def test_get_doc_info_schema_includes_optional_node_id(self) -> None:
        schema = next(
            item["function"]
            for item in get_tools()
            if item.get("type") == "function" and item.get("function", {}).get("name") == "get_doc_info"
        )

        properties = schema["parameters"]["properties"]
        self.assertIn("doc_id", properties)
        self.assertIn("node_id", properties)
        self.assertEqual(properties["node_id"]["type"], "string")
        self.assertEqual(schema["parameters"]["required"], ["doc_id"])

    def test_update_doc_info_schema_uses_nodes_and_parent_node_id(self) -> None:
        schema = next(
            item["function"]
            for item in get_tools()
            if item.get("type") == "function" and item.get("function", {}).get("name") == "update_doc_info"
        )

        properties = schema["parameters"]["properties"]
        self.assertIn("doc_id", properties)
        self.assertIn("nodes", properties)
        self.assertIn("parent_node_id", properties)
        self.assertNotIn("documentation", properties)
        self.assertEqual(properties["nodes"]["type"], "array")
        self.assertEqual(properties["nodes"]["items"]["$ref"], "#/$defs/doc_info_node")
        node_schema = schema["parameters"]["$defs"]["doc_info_node"]
        self.assertEqual(node_schema["type"], "object")
        self.assertIn("title", node_schema["properties"])
        self.assertIn("summary", node_schema["properties"])
        self.assertIn("children", node_schema["properties"])
        self.assertEqual(
            node_schema["properties"]["children"]["items"]["$ref"],
            "#/$defs/doc_info_node",
        )
        self.assertEqual(
            node_schema["required"],
            ["id", "title", "summary", "page_start", "page_end"],
        )
        self.assertEqual(schema["parameters"]["required"], ["doc_id"])


if __name__ == "__main__":
    unittest.main()
