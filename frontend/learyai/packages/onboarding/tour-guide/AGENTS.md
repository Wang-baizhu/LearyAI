# 模块角色
- `tour-guide` 提供页面分步引导能力：步骤注册、聚光遮罩、提示弹层、步骤推进与本地持久化。

# 目录说明
- `src/context.tsx`：维护步骤注册/注销、当前步骤计算、`nextStep` 推进与 `tour_seen_{tag}` 持久化。
- `src/TourStep.tsx`：将业务节点注册为引导步骤锚点。
- `src/TourOverlay.tsx`：渲染遮罩与提示卡片（不承载流程推进规则）。
- `src/utils.ts`：包内轻量工具函数。
- `src/index.ts`：包内统一导出入口。
- `index.ts`：根层转发入口，保持 `@leary/tour-guide` 导入路径稳定。
- `package.json`：包元信息，声明包入口文件为 `./index.ts`，再由根入口转发到 `./src/index.ts`。

# 使用注意事项
- `TourStep` 仅用于“挂载步骤锚点”，不要在业务上依赖它作为布局容器。
- 当前 `TourStep` 使用 `display: contents`，避免影响 `flex/grid` 布局尺寸；不要改回 `inline-block` 或 `fit-content`，否则会导致卡片/标签被压缩。
- 传给 `TourStep` 的 `children` 必须是单个可渲染 DOM 容器（最终能落到真实元素），以便聚光层正确获取目标位置。
- 当前项目使用“纯步骤展示”模式：仅通过提示卡片“知道了”按钮执行 `nextStep` 推进。
- 引导展示期间会拦截页面交互；高亮目标与页面其余区域均不可操作，避免误触导致错步。
- 关闭提示卡片（右上角 `X`）会触发 `dismissTour`：将当前 `tag` 标记为已读并结束本轮引导；如需重看需清理 `tour_seen_{tag}`。
- 重置引导时，清理 `localStorage` 中 `tour_seen_{tag}` 对应键。

# 接入约定
- 页面侧应使用 `TourProvider` 包裹目标区域，并在同层放置一个 `TourOverlay`。
- 页面侧以“步骤挂载 + 文案编排”为主，不依赖业务事件自动推进。
- `ProjectDetailPage` 已接入 `guide:project-detail:v1`。
- 步骤 1：项目成员侧栏卡片（提示可管理成员权限）。
- 步骤 2：右下角“创建内容”按钮（提示可新建知识库）。
