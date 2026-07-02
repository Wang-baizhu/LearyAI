# Agents 指南 (AGENTS.md)

本文档为 AI 代理（Agents）提供关于本管理后台项目的架构说明与开发规范，以便于后续的自动化维护与功能扩展。

## 1. 架构概览

本项目采用 **业务模块化 + 轻量分层** 架构。

- **核心原则**：业务逻辑优先保留在模块内部，只有在确实需要跨模块复用时才提取到 `shared` 层。
- **目录结构**：
  - `src/app/`: 全局配置与 Provider。
  - `src/layouts/`: 页面布局组件（Sidebar, Header, AdminLayout）。
  - `src/shared/`: 基础设施（API 客户端、通用 UI 组件、工具函数、全局类型）。
- `src/modules/`: 业务领域模块（Auth, User, Usage, Invite, RegisterInvite, TaskDlq, ReviewTask）。
  - `src/pages/`: 路由页面，仅作为模块组件的组合容器。

## 2. 开发规范

### 2.1 新增业务模块
当需要添加新的管理面板时，请遵循以下步骤：
1. 在 `src/modules/` 下创建新目录（如 `order`）。
2. 定义 API 契约：`src/modules/order/api/order.api.ts`。
3. 编写业务 Hook：`src/modules/order/hooks/useOrder.ts`。
4. 开发模块组件：`src/modules/order/components/`。
5. 在 `src/pages/` 创建入口页面并配置路由。

### 2.2 API 调用
- 使用 `src/shared/api/client.ts` 导出的 `apiClient`。
- 所有接口响应应遵循 `ApiResponse<T>` 类型定义。
- 后端类型来源统一为 `src/shared/types/backend.generated.ts`（由仓库脚本自动生成），禁止在业务模块手写后端 DTO 契约。
- 运行时响应校验映射来源统一为 `src/shared/types/backend.validation.generated.ts`，由仓库脚本自动生成并由 `src/shared/api/client.ts` 自动执行校验。
- 路径别名：使用 `@/` 指向 `src/` 目录。

### 2.3 UI 规范
- **样式**：严格使用 Tailwind CSS。
- **组件**：优先复用 `src/shared/components/` 中的 `Card`, `Button`, `Badge` 等原子组件。
- **图标**：统一使用 `lucide-react`。

## 3. 汉化与国际化
- 本项目目前以中文为主要界面语言。
- 新增功能时，请确保文案、占位符及提示信息使用中文。

## 4. 状态管理
- **服务端状态**：使用 `@tanstack/react-query`。
- **本地状态**：优先使用 React 原生 `useState` 或模块级 Hook，避免过度使用全局 Store。

---
*本文件由 AI 代理生成，旨在辅助后续开发。*
