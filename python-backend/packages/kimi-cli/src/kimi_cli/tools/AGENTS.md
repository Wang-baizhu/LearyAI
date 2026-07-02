# Kimi CLI Tools

## Guidelines

- 除了直接参与交互协议的工具（如 `Agent`、`AskUserQuestion`、plan mode 工具）外，其它 tools 不应直接依赖 `kimi_cli/wire/` 下的类型。像 `ToolReturnValue`、`DisplayBlock` 这类通用类型，应优先从 `kosong.tooling` 导入。
- 通用工具当前以 `shell/file/web/todo` 的上游语义为准：`Shell` 支持 `run_in_background`，`SetTodoList` 以 `completed` 作为完成态输入，并统一映射到现有展示块中的 `done`；当前实现会把 todo 列表写回 `Session.state.todos`，再经 `store.SessionStore` 后端持久化。
