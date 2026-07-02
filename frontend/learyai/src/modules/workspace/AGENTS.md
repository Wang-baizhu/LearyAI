# 模块角色
- 工作区主视图容器，承载顶层导航与各域组合显示。
- 仅通过 `index.ts` 暴露页面组件。

# 目录速览
- `adapter/`：工作区访问外部模块的受控适配层，用于收敛跨模块依赖并暴露工作区语义化接口。
- `pages/WorkspacePage.tsx`：工作区页面主体，负责布局和域模块挂载。
  - 负责首登概念介绍与工作区主流程引导步骤编排（依赖仓库根 `packages/onboarding/intro-animation`、`packages/onboarding/tour-guide`，导入名分别为 `@leary/intro-animation`、`@leary/tour-guide`）。
  - 弹窗内引导锚点不在页面内编排，改由弹窗组件自身维护独立 `guideTag`。
- `widgets/`：工作区内部局部组件（如导航、面板）。
- 首页 `Hero` 负责工作区欢迎语、图标和简介信息，当前使用打字机和横向滚动文案效果；`QuickActions` 与知识库概览已按移动端收敛为更紧凑的布局。
- 首页 `QuickActions` 当前接入“浏览集市”等快捷入口；工作区不再承担模板开发包下载能力。

# 对外出口（index.ts）
- 组件：`WorkspacePage`。
