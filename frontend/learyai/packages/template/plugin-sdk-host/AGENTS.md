# 模块角色
- `@leary/template-plugin-sdk-host` 负责宿主 iframe 侧协议接线、能力路由和标准回包能力。
- 本包只处理通信与协议，不持有资源中心、AI、template_data 等业务逻辑。

# 内部实现说明
- `createTemplatePluginHost` 是宿主侧唯一接入点，内部先用 `createMessageBus` 建立窗口消息总线，再把协议消息路由成业务 handler。
- `onPluginReady` 只负责接收模板侧控制消息，不负责渲染、数据查询或状态缓存。
- `registerHandler` 把 `plugin.storage.*.request`（含 `storage.info`）、`plugin.text-edit.request`、`plugin.ai-action.request`、`plugin.citation-jump.request` 统一转成宿主业务回调，再由 SDK 回标准响应或错误。
- `sendRender`、`syncTheme`、`syncCapabilities`、`sendDispose` 是宿主对模板的状态快照推送，调用方应把它们当作最新状态而不是增量补丁。

# 使用方式
- 宿主 iframe 组件初始化时创建一次 `createTemplatePluginHost({ targetWindow })`，`targetWindow` 应始终指向当前模板 iframe 的 `contentWindow`。
- 宿主在收到 `plugin.ready` 后再推首包 `host.render`，避免 iframe 运行时监听未挂上就丢消息。
- 对需要持久化、AI 触发、跳转等能力的模板，只暴露对应 `registerHandler`，不要在模板侧直接调用宿主内部业务函数。
- 关闭模板或切换 iframe 时要调用 `sendDispose()` 和 `dispose()`，避免旧监听残留。

# 约束
- 宿主必须用 `targetWindow` 做 source 过滤，禁止接受其他窗口伪造消息。
- `registerHandler` 的职责是把协议层请求路由到宿主业务 handler，再统一回包或回错。
