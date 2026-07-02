<!-- 责任：说明管理端本地运行与后端联调方式 -->
# learyadmin 管理端

## 本地运行
1. 安装依赖：`npm install`
2. 复制环境变量：将 `.env.example` 复制为 `.env.local` 并按需修改
3. 启动开发：`npm run dev`
4. 类型检查：`npm run lint`

## 环境变量
- `VITE_API_BASE_URL`：前端请求基路径，默认 `/api`
- `VITE_PROXY_TARGET`：Vite 开发代理目标后端地址，默认 `http://127.0.0.1:8080`
- `VITE_PORT`：本地开发端口，默认 `3000`

## 已对接的 admin 协议接口
- `GET /api/admin/users/summary`
- `GET /api/admin/users/recent-logins`
- `GET /api/admin/usage/summary`
- `GET /api/admin/usage/snapshot/list`
- `GET /api/admin/invites`
- `GET /api/admin/invites/{inviteId}`
