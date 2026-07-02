# 包角色
- `@leary/eslint-config` 提供前端统一 ESLint 配置能力，服务 `learyai` 主应用与后续 workspace 包复用。
- 在架构治理上，该包负责“开发期实时反馈”；`frontend/learyai/packages/common/arch-check` 负责“架构规则权威审计与 CI 兜底”。

# 目录说明
- `src/`：TypeScript 源码（按检查面拆分规则与 preset 组合逻辑）。
- `dist/`：运行时 JS 产物，供 ESLint 在 Node 环境直接加载。
- `index.js`：包运行入口，转发到 `dist/define-config.js`。
- `index.ts`：类型入口，转发到 `src/define-config.ts`。

# 当前检查范围
- `React`：
  - Hooks 规则：`exhaustive-deps`、`refs` 保持 `error`；`set-state-in-effect`、`preserve-manual-memoization` 先按 `warn` 灰度。
- `TypeScript`：
  - `consistent-type-imports`（warn）。
  - 测试文件豁免 `no-explicit-any`。
- `安全`：
  - `no-empty`（禁止空 `catch`）。
- `Import/依赖`：
  - `import/no-cycle`（error，检查循环导入）。
  - 限制 `import * as` / `export *`（warn）。
  - 限制超过 4 层相对路径导入（warn）。
  - 限制深层穿透 `@leary/*` 包内部路径（warn）。
  - 限制跨 module 深层穿透（error，要求通过 module 公开出口）。
- `架构分层`（`src/modules`）：
  - 作为开发期即时提示：限制跨 slice 直接引用根文件与内部目录（`ui/model/api/lib/...`）。
  - 作为开发期即时提示：`shared` 禁止依赖 `modules`。
  - 作为开发期即时提示：`widgets/features/entities/module shared` 按分层方向限制上游依赖。
  - 说明：上述约束在 `packages/common/arch-check` 中也有权威审计实现；两者并存是有意设计（ESLint 提升本地反馈速度，arch-check 保证 CI 一致性）。

# 使用约定
- 根 `eslint.config.js` 通过 `defineLearyEslintConfig({ preset: 'web' })` 进行装配。
- 新增规则时优先放入 `src/rules/*` 对应检查面，再在 `src/rules/base.ts` 聚合。
- 破坏性规则建议先 `warn` 灰度，再升级 `error`。
- 涉及目录结构、文件组织、slice 形态等“结构审计型”规则时，优先落在 `packages/common/arch-check`；ESLint 侧仅保留必要的实时提示规则，避免双端实现漂移。
