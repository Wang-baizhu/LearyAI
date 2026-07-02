# 模块角色
- 负责登录/注册/验证流程与用户会话状态，提供路由守卫。
- 对外只通过 `index.ts` 获取页面、API hooks、用户实体与路由组件。
- 登录成功与注册成功（验证码验证通过后）会触发全局右上角横条提示（toast）。

# 目录速览
- `pages/`：`AuthPage` 登录注册页。
- `features/auth-core/api/`：`authApi` 定义登录、注册、验证码请求；登录/注册等已入 OpenAPI 的接口类型必须来自 `shared/api/contract.ts`，禁止手写后端 DTO。
- `features/hooks/`：`useAuthFeature` 组合短信注册、邀请码注册与登录逻辑。
- `entities/user/`：`hooks/sessionHooks` 暴露 `useUserSession`、`useCurrentUser` 等 hooks，`store/userSlice` 提供 `userReducer`。
- `features/auth-core/ui/RequireAuth`：路由访问控制；在 `sessionReady=false` 时展示页面级 `HyperSpeedLoader` 加载动画。

# 对外出口（index.ts）
- 组件：`AuthPage`、`RequireAuth`。
- API：`authApi`。
- Hooks：`useAuthFeature`、`useUserSession`、`useCurrentUser`。
- Reducer：`userReducer`。
- 类型：`LoginPayload`、`RegisterPayload`、`VerificationPayload`、`LoginResponse`、`UserSession`。
