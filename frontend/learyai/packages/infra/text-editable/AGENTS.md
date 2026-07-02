# 模块角色
- `@leary/text-editable` 提供应用内横切文本编辑交互能力，负责统一的编辑触发器、编辑弹层与最小会话模型。

# 目录说明
- `src/ui/EditableText.tsx`：可编辑文本块触发器，负责包裹文本并发出编辑请求。
- `src/ui/EditableTextDialog.tsx`：统一文本编辑弹层，负责单行/多行输入、错误展示与保存按钮。
- `src/model/types.ts`：定义 `EditableTextSession` 通用会话类型。
- `src/index.ts`：包内统一导出入口。
- `index.ts`：根层转发入口，保持 `@leary/text-editable` 导入路径稳定。
- `docs/`：模块职责、能力边界与外部接入说明。

# 使用注意事项
- 包本身只负责交互层，不负责业务锚点设计、正文 patch、接口保存与 checkpoint。
- 使用方应在业务层自定义 `anchor`，并在宿主层承接 `onSave` 的真实持久化逻辑。
