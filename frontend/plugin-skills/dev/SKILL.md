---
name: create-leary-template
description: 用于创建、补全或重构 Leary React 模板插件。
---

# Leary 模板插件开发

- 背景：一个专门用于对接Leary应用可视化模板的插件，通过@leary/template-plugin-sdk-react和脚手架完成模板插件的开发。实现通过传入自定义MD格式的Content进行渲染到自己开发的模板插件中。

## 1. 初始化脚手架

- 检查当前目录是否已初始化脚手架，如未初始化运行命令`<待补齐命令>`

## 2. 了解用户需求，设计模板Content格式

明确：

- 模板接收的Markdown、MDX的格式是怎样的，以及每个标识对应的含义是什么。

如需要模板是“文档型内容展示”，可采用可枚举的 Markdown/MDX 分区协议，类似：

```md
#【SECTION_NAME】
这里是该分区正文
```

确定后将对应的Content结构规则写入`manifest.json`的toolPrompt
"prompt_json_schema": {
    "toolPrompt": "这是一份说明书文档，使用“# 【章节名】”作为说明书文档的章节名，下方的内容即为章节的内容。"
  },
并写一个示例Content至toolPromptExample。
"toolPromptExample": "# 【章节一】\n章节一讲了..."


## 3. 按需读取参考资料

- SDK使用手册：[references/sdk.md](./references/sdk.md)
  用于确认 `@leary/template-plugin-sdk-react`、`useTemplatePluginClient()`、`EditableContent` 的推荐接法和能力边界。
- manifest.json说明手册：[references/manifest.md](./references/manifest.md)
  解释manifest字段说明。

## 4. 完成开发并验收

参考SDK开发手册完成用户所需的模板插件，确保最后验收时运行`npm/pnpm validate`

注意：

- 确保`manifest.json`只启用必要的capabilities，确保`manifest.json`正确补全。