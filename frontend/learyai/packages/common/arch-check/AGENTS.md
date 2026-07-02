# 包角色
- `@leary/arch-check` 提供前端架构规则的权威审计能力，服务 `learyai` 主应用与后续需要复用 FSD/模块布局校验的 workspace 项目。
- 该包负责“结构审计型”检查，包括通用 FSD slice 规则、Leary 顶层 module 布局规则、shared/app 边界规则与 profile 装配。

# 目录说明
- `src/`：架构校验源码，按“装配 / 规则 / 工具”拆分。
- `src/run-check.mjs`：规则装配入口，基于 profile 执行校验并返回结果。
- `src/profiles.mjs`：定义 `leary-module`、`generic-fsd` 等 profile。
- `src/fsd-rules.mjs`：通用 FSD slice 结构规则。
- `src/module-layout-rules.mjs`：Leary 顶层 `modules/<module>` 布局规则。
- `src/app-rules.mjs`、`src/shared-rules.mjs`：app/shared 层边界规则。
- `src/import-utils.mjs`、`src/fs-utils.mjs`、`src/collector.mjs`、`src/constants.mjs`：基础工具层。
- `index.mjs`：根层公开 API 入口，保持 `@leary/arch-check` 导入路径稳定。
- `cli.mjs`：包内 CLI 入口，供宿主脚本转调。
- `test/`：独立 fixtures 与 API/CLI 测试，验证 profile、诊断结果和命令行行为。

# 使用约定
- 新增只约束单个 slice 内部结构的规则，优先放入 `src/fsd-rules.mjs`。
- 新增只约束 Leary 项目顶层 module 布局的规则，优先放入 `src/module-layout-rules.mjs`。
- `src/shared-rules.mjs` 当前额外约束 module 内 `shared` 顶层职责目录（如 `shared/ui`、`shared/config`、`shared/lib`、`shared/types`）下不得再次出现同名职责目录重复嵌套，例如 `shared/config/**/config`、`shared/ui/**/ui`。
- 仅调整某个项目启用范围时，优先增改 `src/profiles.mjs`，不要复制规则实现。
- 宿主项目可保留薄兼容入口，但具体规则实现应继续收敛在本包内，避免回流到 `scripts/`。
- 调整 CLI、profile 或诊断格式时，必须同步更新 `test/` 下的独立测试与 fixtures。
