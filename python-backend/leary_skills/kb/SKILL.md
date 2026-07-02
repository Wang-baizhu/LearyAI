---
name: kb
description: 可查询用户上传的知识库内容。
---

# KB Skill

本 skill 负责查询知识库信息与异步任务结果，在调用search后60s未返回结果会直接返回一个task信息，后续根据此task信息查询search结果。

- `search`：走 `backend /api/skills/search`，必须提供 `LEARY_KB_TOKEN`，返回精简查询结果
- `task`：走 `backend /api/skills/tasks`，必须提供 `LEARY_KB_TOKEN` 和 `taskId`，返回对应任务的精简结果

## CLI

- `search/task` backend 地址固定为：`http://192.168.31.160:8080/api`
- `search/task` 必须通过环境变量 `LEARY_KB_TOKEN` 提供 token；若未提供，会提示先在终端执行 `export LEARY_KB_TOKEN="<你的token>"`

## 命令

- `search`
- `task`

## 示例

```bash
export LEARY_KB_TOKEN="<你的token>"
python3 your_path/kb/scripts/kb_cli.py search --query "输入你想在知识库查询的内容"
python3 your_path/kb/scripts/kb_cli.py task --task-id "6dd0b45f-77b1-4fca-8f1f-f4a3d4b8e8aa"
```
