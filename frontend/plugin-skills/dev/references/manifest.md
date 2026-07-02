# `manifest.json` 字段说明

这份文档用于说明 Leary 模板插件 `manifest.json` 中各字段的用途、填写约束和常见取值。

## 1. 最小示例

```json
{
  "name": "my-template-plugin",
  "version": "0.1.0",
  "sdkVersion": "0.0.0",
  "entryHtml": "dist/index.html",
  "assetBaseDir": "dist/assets",
  "displayName": "My Template Plugin",
  "capabilities": {
    "render": true,
    "theme": true,
    "storage": true,
    "textEdit": true,
    "aiAction": true,
    "citationJump": true
  },
  "prompt_json_schema": {
    "toolPrompt": "填入模板 content 的结构提示词"
  },
  "toolPromptExample": "# 示例标题\n\n这里是模板默认内容示例。"
}
```

## 2. 顶层字段

### `name`

- 类型：`string`
- 作用：插件唯一名称，用于标识当前模板插件。
- 要求：
  - 建议使用小写英文、数字、中划线组合
  - 在同一批插件中应保持唯一
- 示例：`"name": "react-example"`

### `version`

- 类型：`string`
- 作用：当前插件版本号。
- 要求：
  - 建议使用 semver，例如 `0.1.0`、`1.0.0`
- 示例：`"version": "0.2.0"`

### `sdkVersion`

- 类型：`string`
- 作用：声明模板接入的 SDK 版本。
- 要求：
  - 与实际使用的 `@leary/template-plugin-sdk-react` 版本保持一致
  - 模板脚手架默认占位值是 `0.0.0`，正式开发时应按实际版本更新
- 示例：`"sdkVersion": "0.0.0"`

### `entryHtml`

- 类型：`string`
- 作用：宿主加载模板时的入口 HTML 路径。
- 要求：
  - 路径相对于插件根目录
  - 通常指向构建产物，例如 `dist/index.html`
- 示例：`"entryHtml": "dist/index.html"`

### `assetBaseDir`

- 类型：`string`
- 作用：声明静态资源根目录，供宿主解析模板依赖资源。
- 要求：
  - 路径相对于插件根目录
  - 一般与构建工具产物目录一致，例如 `dist/assets`
- 示例：`"assetBaseDir": "dist/assets"`

### `displayName`

- 类型：`string`
- 作用：插件展示名，用于 UI 中展示给用户。
- 要求：
  - 可读性优先，允许中文或更友好的品牌名
- 示例：`"displayName": "说明文档书"`

### `prompt_json_schema`

- 类型：`object`
- 作用：定义生成模板内容时给模型的提示词配置。
- 要求：
  - 至少提供 `toolPrompt`
  - 内容应明确模板可接收的 content 结构、分区规则和输出约束

当前常见子字段如下。

#### `prompt_json_schema.toolPrompt`

- 类型：`string`
- 作用：Content格式说明，告诉模型应该输出什么样的 Markdown/MDX 内容。
- 适合描述：
  - 固定章节名
  - 标题层级规则
  - 是否允许列表、表格、子标题
  - 禁止输出的内容，例如 JSON、解释性文字、代码块围栏

#### `prompt_json_schema.flow_custom_prompt`

- 类型：`string`
- 作用：用于分批生成长Content时如何拼接和划分的提示词。
- 场景：
  - Content批量拼接生成时不稳定。
- 说明：
  - 该字段默认不要生成。

### `toolPromptExample`

- 类型：`string`
- 作用：提供一段默认 content 示例，帮助开发调试和首屏预览。
- 要求：
  - 内容必须能被当前模板直接渲染
  - 应与 `toolPrompt` 中定义的格式保持一致
- 常见用途：
  - dev playground 选中模板后作为默认内容载入
  - 首次预览时模拟宿主传入的 `render.content`

### `sdkPackage`

- 类型：`string`
- 作用：声明当前模板依赖的 SDK 包名。
- 说明：
  - 该字段在现有模板中是可选字段
  - 当前仓库示例里常见值为 `@leary/template-plugin-sdk-react`
- 示例：`"sdkPackage": "@leary/template-plugin-sdk-react"`

## 3. `capabilities` 字段

`capabilities` 用于声明模板需要宿主开启哪些能力。原则是只开启必要能力，不要无意义全部打开。

### `capabilities.render`

- 类型：`boolean`
- 作用：允许宿主向模板下发渲染内容。
- 何时开启：
  - 模板需要消费 `render.content` 或其他渲染数据时开启
- 通常情况：
  - 大多数模板都需要开启

### `capabilities.theme`

- 类型：`boolean`
- 作用：允许宿主同步主题信息给模板。
- 何时开启：
  - 模板需要跟随宿主明暗主题或样式变量时开启

### `capabilities.storage`

- 类型：`boolean`
- 作用：允许模板读写宿主提供的存储能力。
- 何时开启：
  - 需要保存草稿、作答记录、局部状态时开启

### `capabilities.textEdit`

- 类型：`boolean`
- 作用：允许模板发起文本编辑相关请求。
- 何时开启：
  - 模板内部需要调用宿主编辑器或基于正文触发编辑动作时开启

### `capabilities.aiAction`

- 类型：`boolean`
- 作用：允许模板请求宿主执行 AI 动作。
- 何时开启：
  - 模板中有 AI 续写、总结、改写、分析等交互时开启

### `capabilities.citationJump`

- 类型：`boolean`
- 作用：允许模板触发引用跳转能力。
- 何时开启：
  - 模板中需要从内容块跳转到引用来源、原文位置或关联上下文时开启

## 4. 编写建议

### 先写清 `toolPrompt`，再写模板 UI

如果 `toolPrompt` 没有先把 content 结构定义清楚，模板 UI 很容易一边开发一边改协议，最终导致渲染逻辑反复返工。

### `toolPromptExample` 必须可直接渲染

不要把它写成说明文档或伪代码。它应该是一份真实示例内容，确保在 dev playground 中能直接验证模板效果。

### `capabilities` 只保留必要项

如果模板没有存储、AI、引用跳转等需求，就不要打开对应能力。这样更符合模板职责边界，也更容易排查问题。

## 5. 验收检查

完成 `manifest.json` 后，至少检查以下几点：

1. `entryHtml` 和 `assetBaseDir` 指向的路径在构建产物里真实存在。
2. `toolPrompt` 与模板实际解析逻辑一致，没有分区名不匹配的问题。
3. `toolPromptExample` 能在 dev playground 中直接渲染成功。
4. `capabilities` 没有开启模板未使用的宿主能力。
