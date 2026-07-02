---
name: kb-explorer
description: To explore the content's docIds and page_num.
type: flow
---

```mermaid
flowchart TB
    A(["BEGIN"]) --> B["请你探索：${CONTENT_TO_EXPLORER}，并总结返回输出"]
    B --> C(["END"])
```
