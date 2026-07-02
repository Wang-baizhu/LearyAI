更新指定文档的信息，支持按父节点直接覆盖一层 `documentation` nodes。

**何时使用：**

* 需要补充或修正文档概要、标签、参考目录或文档名时
* 在检索前完善文档元信息
* 需要覆盖根级目录或某个父节点下的直接子节点时

**参数：**

* `name`（字符串，可选）—— 文档名称
* `doc_id`（字符串，必填）—— 文档业务 docId（UUID）
* `description`（字符串，可选）—— 文档概要
* `tag`（字符串，可选）—— 标签，使用空格分隔多个tag
* `parent_node_id`（字符串，可选）—— 目标父节点 id；不传表示直接覆盖根级 `nodes`
* `nodes`（数组，可选）—— 该父节点下完整的直接子节点列表。每个 node 结构为：

```json
{
  "id": "chapter-1",
  "title": "第一章 项目背景",
  "summary": "介绍项目目标、范围和术语",
  "page_start": 1,
  "page_end": 12,
  "children": []
}
```

**输出要求：**

* `arguments` 必须是合法 JSON 对象
* `nodes` 必须直接传数组对象，不要把整个数组再次编码成 JSON 字符串
* `nodes` 中每一级节点都必须完整包含 `id`、`title`、`summary`、`page_start`、`page_end`、`children`
* `summary` 不能为空字符串，`page_start`/`page_end` 必须是整数，且 `page_start <= page_end`
* `title`、`summary` 中即使包含 `"` 也保留原文，不要手工拼接整段转义 JSON
* 生成参数后先自检：`arguments` 应能被标准 JSON 解析器成功解析

**覆盖规则：**

* 不传 `parent_node_id` 且传 `nodes`：覆盖根级 `documentation.nodes`
* 传 `parent_node_id` 且传 `nodes`：覆盖该节点的直接 `children`
* 覆盖时不会改动树上的其他分支
* `nodes` 必须是该层的完整列表，不支持增量追加单个 child
* `name`、`tag`、`description` 可与本次调用一并更新

**返回：**

* `success`（布尔值）—— 是否更新成功
* 成功时会返回本次更新的 `doc_id`、`parent_node_id`、`nodes` 等信息
