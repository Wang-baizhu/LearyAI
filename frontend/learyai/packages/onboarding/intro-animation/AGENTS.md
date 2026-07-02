# 模块角色
- `intro-animation` 提供首次进入页面时的概念介绍全屏动画，用于按顺序展示术语与说明并在结束后回调业务方。

# 目录说明
- `src/IntroAnimation.tsx`：动画主体，负责分步切换、自动播放与结束回调。
- `src/index.ts`：包内统一导出入口。
- `index.ts`：根层转发入口，保持 `@leary/intro-animation` 导入路径稳定。
- `package.json`：包元信息，声明包入口为 `./index.ts`，再由根入口转发到 `./src/index.ts`。

# 使用注意事项
- `items` 为空时不渲染任何内容，页面侧需自行控制兜底展示。
- `autoPlayDuration` 单位为毫秒，传 `0` 可关闭自动播放，仅保留手动切换。
- `onComplete` 在最后一步完成或点击 `Skip Intro` 后触发，页面侧应在回调里持久化“已读”状态。
- 动画会读取全局 `ThemeContext` 的 `isDarkMode` 自动切换明暗配色，无需额外传参。
