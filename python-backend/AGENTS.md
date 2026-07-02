### 项目说明
- agent_ws实现了基于kimi_cli（packages/kimi-cli）的完整ws服务端
- packages/kimi-cli包含完整agent内核
    - packages/kimi-cli/src/kimi_cli/AGENTS.md：kimi-cli整体项目说明
    - packages/kimi-cli/src/kimi_cli/acp/AGENTS.md：kimi-cli的acp层说明
    - packages/kimi-cli/src/kimi_cli/soul/AGENTS.md：kimi-cli的核心驱动说明
    - packages/kimi-cli/src/kimi_cli/store是agent持久化的实现，ws服务端使用的是rdb
- packages/kimi-cli/src/kimi_cli/wire-mode.md包含wire协议的讲解
- packages/knowledge-base 提供知识库检索与 kb_doc.metadata 读写工具（`knowledge_base/application/kb_doc_service.py`）
- packages/task_events 提供 Python 服务公共的任务状态 outbox、RabbitMQ publisher 与任务执行去重能力
- `agent_runtime/registry.py` 维护 python-backend 公共的 agent 运行时配置解析（agents/skills/models_config 与 `agentTaskType -> flow`），当前仅保留知识库问答/搜索/关系图等常规运行时配置目录 `agent_runtime/config/agent`。
### 回复规则
- 使用中文回答
- 修改前
    - 确保先明确修改的内容的背景（获取足够的代码上下文）
    - 然后明确修改步骤；若有疑问，提出的分歧方案需给出对应的利弊和你推荐的方案
    - 待用户确认后再进行修改（使用读取上下文工具无需经过确认）；若用户明确指明“直接修改”，则无需获取多余信息，则根据用户明确提到的文件信息或上下文直接进行读取修改。
- 代码编写原则
    - 顶部使用注释标明当前文件的职责
