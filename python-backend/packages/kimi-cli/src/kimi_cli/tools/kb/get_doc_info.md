获取指定文档的 instructions 拼接信息。

**何时使用：**

* 当需要快速了解文档概要、标签与参考目录时
* 在检索/拉取分块前确认文档上下文
* 查询的node_id请严格根据返回node_id作为输入，避免编造node_id

**参数：**

* `doc_id`（字符串，必填）—— 文档业务 docId（UUID）
* `node_id`（字符串，可选）—— 文档目录节点 id；传入后只查看该节点的下一层

**返回：**

* 未传 `node_id` 时，返回基础信息与目录信息：

  * 基础信息：`doc_id`、`total_page`、`name`、`tag`、`description`
  * 目录信息统一放在 `documentation`
  * 目录按层级加载；某一层若完整信息超过预算，则从该层开始只返回 `id/title/page`

* 传入 `node_id` 时，只返回渐进式目录信息：

  * 只返回 `documentation`
  * 同样按层级加载；某一层若完整信息超过预算，则从该层开始只返回 `id/title/page`

* 返回规则: 
  * `documentation` 是唯一的目录树载体
  * 预算按层级判断，不再按单个节点零散截断
  * 如果当前层级信息不足以定位内容，可继续传更深层的 `node_id` 往下查看
