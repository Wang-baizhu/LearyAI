# 模块角色
- `@leary/template-plugin-sdk-react` 负责提供模板 iframe 侧的 React 接线能力，包括 ready/render/theme/request API。
- 本包只面向插件运行时，不承载宿主业务逻辑。
- React 运行时必须由最终模板应用提供；本包只能通过 `peerDependencies` 声明 `react` / `react-dom`，不能在 `dependencies` 中自带运行时副本。
- 浏览器通用的 ready 重试、快照回放、request tracker 与单例管理统一下沉到 `@leary/template-plugin-sdk-web`；本包只保留 React hook 与 content runtime 适配层。

# 内部实现说明
- `useTemplatePluginClient` 负责把模板 iframe 的生命周期和消息通道收敛成单一 client。
- 同一个模板页面内，SDK 会在 `window` 上维护唯一一份 client 单例；`EditableContent`、runtime 和业务桥接层都会复用它。
- `useTemplatePluginClient` 只负责把 React 生命周期接到 browser client 单例上；真正的消息通道、ready 重试、请求跟踪都由 `@leary/template-plugin-sdk-web` 提供。
- `createBufferedStorageWriter` 负责按 storage key 合并高频 `set` 写入，并协调 `remove` / `clear` / `dispose` 的 pending 请求处理。
- `onRender`、`onThemeSync`、`onCapabilitiesSync` 会先回放最近一次宿主快照，再继续订阅后续消息，保证首屏渲染拿到最新状态。
- `requestGetStorage`、`requestSetStorage`、`requestRemoveStorage`、`requestClearStorage`、`requestTextEdit`、`requestSaveContent`、`requestAiAction`、`requestCitationJump` 都通过 `requestTracker` 管理 pending promise，不能在模板业务层重新封装一套并发状态。
- `content/*` 是模板侧正文展示主入口，内部集成引用解析、引用跳转和编辑请求；`types.ts` 负责扩展协议定义，`ui/renderDefaultContent.tsx` 负责默认正文渲染，`lib/*` 负责内容解析与行为计算。
- 引用解析细节不作为公开入口暴露，模板业务如需扩展正文展示，优先通过 `extensions`、`renderContent` 或 `createEditableContentPreset` 扩展。

# 使用方式
- 模板应用入口挂载后直接调用 `useTemplatePluginClient()`，再通过返回的 `onRender`、`requestGetStorage`、`requestSetStorage`、`requestAiAction` 等 API 编排业务。
- 本地 devtools 如需 mock 首屏渲染，只允许通过 `useTemplatePluginClient({ devtools: { mockRenderPayload: { content } } })` 传入正文；`pluginId`、`templateId`、`referenceTitles` 由 SDK 自动补齐，业务模板不要再手工传这些字段。
- 当模板页面里既有桥接层、又使用 `EditableContent` / runtime 组件时，仍然只需要调用 `useTemplatePluginClient()` 复用同一份单例。
- 如果模板正文需要展示带引用的内容，优先直接使用 `@leary/template-plugin-sdk-react/content` 的 `EditableContent`，不要在模板业务层自行解析引用标签或重复透传宿主上下文；只有需要覆盖局部编辑定位或“编辑结果 -> 整份 content patch”规则时才额外使用 `TemplatePluginRuntimeProvider`。
- 模板内部不要再直接写 `window.parent.postMessage`，也不要自己维护 `ready` 重试和请求队列。
- `requestTextEdit` 只负责统一拉起宿主编辑弹窗并返回用户最终输入；模板自己的文档 patch 必须在模板侧完成，再通过 `requestSaveContent` 统一提交整份 `content`。
- 如果模板需要本地编辑、AI 讲解、引用跳转或记录保存，就分别订阅对应的回调并在业务事件里调用 SDK request API。
- 高频记录写入（如 quiz/card 作答过程）优先复用 `createBufferedStorageWriter`；只缓冲同 key 的 `requestSetStorage`，删除与清空必须立即走 `remove/clear`。
- 当模板业务逻辑完成或组件卸载时，交给 hook 自己清理 pending 请求和 message 监听，不要手工复用旧实例。

# 约束
- 模板应用不应再直接操作 `window.postMessage`，统一通过本包导出的 client API 发送消息。
- 所有对宿主的请求都应复用 core 层的 `requestId` 跟踪，不允许模板私自管理 pending promise。
