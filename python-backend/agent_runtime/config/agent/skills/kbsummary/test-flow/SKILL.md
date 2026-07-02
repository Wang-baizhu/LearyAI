---
name: test-flow
description: To test flow.
type: flow
---

```mermaid
flowchart TB
    A(["BEGIN"]) --> B["调用shell工具查询当前时间判断是否为12点到1点"]
    B -- 是 --> D(["END"])
    B -- 不是 --> n1["输出现在的准确时间"]
    n1 --> D
```
