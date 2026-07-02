# 模块角色
- `@leary/template-plugin-sdk-core` 负责定义模板插件宿主协议、消息类型、request/response 跟踪与底层 window transport。
- 本包只承载协议与基础通信，不承载 React 视图逻辑，也不承载资源中心业务适配。

# 内部实现说明
- `protocol.ts` 负责协议常量、消息类型、payload 类型与 `createTemplatePluginMessage`，所有跨窗口消息都要先过这里统一成同一协议格式。
- `messageBus.ts` 负责包一层 `window.postMessage`，只做消息分发和源窗口过滤，不处理业务路由。
- `requestTracker.ts` 负责 request/response 的 pending 映射、`requestId` 生成和批量 abort，模板侧异步请求必须复用这里的 pending 管理。
- `index.ts` 只做公开入口转发，禁止从子路径绕过入口直接引用实现细节。

# 使用方式
- 宿主侧先通过 `createTemplatePluginMessage` 生成标准消息，再交给 `createMessageBus().send()` 发往 iframe。
- 模板侧如果需要等待宿主回包，必须走 `requestTracker` 或基于 `useTemplatePluginClient` 的封装，不要自己拼 `requestId` 字符串。
- 新增消息类型时要同时更新 `TemplatePluginMessageType` 和 `TemplatePluginMessagePayloadMap`，否则宿主与模板两端的类型会脱节。

# 约束
- 所有正式消息必须携带 `protocol = leary.template-plugin.v1`。
- 需要响应的消息统一通过 `requestId` 关联，不允许模板或宿主自行拼接临时字段。
- 本包对外只通过根层 `index.ts` 暴露公开能力。
