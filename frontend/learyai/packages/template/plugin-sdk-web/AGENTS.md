# 模块角色
- `@leary/template-plugin-sdk-web` 负责提供模板 iframe 侧的浏览器通用宿主接线能力，适用于原生 HTML、Vue、Svelte 等非 React 模板。
- 本包只承载浏览器运行时下的协议握手、快照回放、请求跟踪与单例管理，不承载 React 视图逻辑，也不承载模板业务逻辑。

# 内部实现说明
- `createTemplatePluginClient` 负责把模板 iframe 的生命周期和消息通道收敛成单一 browser client。
- 同一个模板页面内，SDK 会在 `window` 上维护唯一一份 client 单例；非 React 模板入口、将来的框架适配层都应复用它。
- `src/client/*` 负责 client 内部拆分：`requestTrackers` 管 pending tracker，`subscriptions` 管宿主消息订阅与快照写入，`publicApi` 管对外 request/onXxx API 组装。
- 这个 client 内部会做三件事：一轮有限次 `plugin.ready` 幂等重试、宿主消息缓存与重放、请求型消息的 pending 跟踪；后续新增协议能力时优先落到 `src/client/*`，不要继续把职责堆回入口文件。

# 使用方式
- 原生 HTML / Vue / 其他框架模板入口挂载后直接调用 `createTemplatePluginClient()`，再通过返回的 `onRender`、`requestGetStorage`、`requestSetStorage`、`requestAiAction` 等 API 编排业务。
- 本地 devtools 如需 mock 首屏渲染，只允许通过 `createTemplatePluginClient({ devtools: { mockRenderPayload: { content } } })` 传入正文；`pluginId`、`templateId`、`referenceTitles` 由 SDK 自动补齐，业务模板不要再手工传这些字段。
- 模板内部不要再直接写 `window.parent.postMessage`，也不要自己维护 `ready` 重试和请求队列。
- 模板业务完成或页面卸载时，调用 `dispose()` 释放 message 监听并中断 pending 请求；HMR 场景统一复用 `resetTemplatePluginClientSingletonForHmr()`。

# 约束
- 模板应用不应再直接操作 `window.postMessage`，统一通过本包导出的 client API 发送消息。
- 所有对宿主的请求都应复用 core 层的 `requestId` 跟踪，不允许模板私自管理 pending promise。
