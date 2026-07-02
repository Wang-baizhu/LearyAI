# 当前文件职责：说明 learyAI K8s base+overlays、GitOps 与稳定性资源的组织方式。

## 目录结构
- `infra`: 集群内基础设施资源（PostgreSQL、Redis、RabbitMQ，含持久化）
- `base`: 公共资源（namespace、backend、agent、taskserver、ingress，不携带环境变量）
- `components/env/{develop,test,prod}`: 各环境 ConfigMap/Secret 生成器与唯一 env 源
- `overlays/external-kb` / `overlays/internal-kb`: KB 地址维度基础 overlay
- `overlays/dev-external-kb`: 本地联调 + 外部 KB（`*:dev` + `imagePullPolicy: IfNotPresent`）
- `overlays/dev-internal-kb`: 本地联调 + 内部 KB（`*:dev` + `imagePullPolicy: IfNotPresent`）
- `overlays/test-external-kb` / `overlays/test-internal-kb`: 首个 GitOps 验证环境
- `overlays/prod-external-kb` / `overlays/prod-internal-kb`: 生产环境 overlay
- `observability`: Loki / Fluent Bit / ServiceMonitor / PrometheusRule / exporter / dashboard
- `platform`: Argo CD、kube-prometheus-stack、Velero 安装骨架
- `ops/postgres-backup`: PostgreSQL 逻辑备份与恢复模板

## 发布主路径
- 主路径：CI 构建镜像 -> 更新 test overlay 镜像 tag -> test 自动同步 -> 审批后 promotion 更新 prod overlay 镜像 tag -> prod 同步。
- 应急路径：人工 `kubectl apply -k ...` 仅用于紧急回滚或首次引导，不作为长期主路径。

### 平台前端发布边界
- 当前 `deploy/k8s` 与 `.gitea/workflows/{ci,promotion}.yaml` 只负责：
  - `leary-plugin-gateway`
  - `leary-backend`
  - `leary-agent`
  - `leary-task`
- `learyai` 与 `admin` 静态前端已从当前 K8s/GitOps/CI 链路解耦：
  - 不再由本目录内的 K8s Deployment 承载
  - 不再由当前 workflow 自动上传对象存储
  - 后续应由独立前端发布流程或 admin 发布状态管理承接
- 当前业务镜像集合：`leary-plugin-gateway`、`leary-backend`、`leary-agent`、`leary-task`。

## 部署前必改
1. 按实际环境直接修改 `deploy/k8s/components/env/<profile>/*.env`
2. 修改后按需执行滚动重启，使 Pod 重新加载 ConfigMap/Secret 环境变量
3. `start.sh` / `provision.sh app` 会在本地缺少 PostgreSQL 自定义镜像 `leary-pg:latest` 时自动构建，并推送到 `deploy/ci-infra/docker-compose.registry.yml` 对应的本地 Registry（默认 `192.168.31.160:15001/leary-pg:latest`）；若你直接手工 `kubectl apply -k deploy/k8s/infra`，仍需先自行构建并推送该镜像
4. 按实际域名修改 `base/ingress.yaml` 的 `host`
5. 按实际镜像仓库修改：
   - `base/backend-deployment.yaml` 的 `image: leary-backend:latest`
   - `base/agent-deployment.yaml` 的 `image: leary-agent:latest`
   - `base/taskserver-deployment.yaml` 的 `image: leary-task:latest`
6. 确保安装nginx的ingress `kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.14.3/deploy/static/provider/cloud/deploy.yaml`

## 部署命令
### 快速启动脚本
```bash
bash deploy/k8s/start.sh dev external
bash deploy/k8s/start.sh dev internal
bash deploy/k8s/start.sh test external
bash deploy/k8s/start.sh test internal
bash deploy/k8s/start.sh prod external
bash deploy/k8s/start.sh prod internal
```

脚本行为与下方手动命令保持一致：
- `dev`：先构建 `:dev` 镜像与 `leary-pg:latest`，再 apply `infra`，等待 PG/Redis/RabbitMQ StatefulSet 就绪，然后 apply overlay，并重启 backend/agent/task 三个 deployment
- `test`：apply `infra`，等待 PG/Redis/RabbitMQ StatefulSet 就绪，然后 apply 对应 overlay；长期推荐改为 Argo CD 自动同步。注意它不会自动把 `test-initial` 改成真实 tag，也不会自动构建 test 业务镜像
- `prod`：apply `infra`，等待 PG/Redis/RabbitMQ StatefulSet 就绪，然后 apply 对应 overlay

- dev + external-kb（本地联调常用）：
```bash
deploy\build-dev.bat
kubectl kustomize --load-restrictor=LoadRestrictionsNone deploy/k8s/infra | kubectl apply -f -
kubectl kustomize --load-restrictor=LoadRestrictionsNone deploy/k8s/overlays/dev-external-kb | kubectl apply -f -
kubectl rollout restart deployment/leary-backend -n learyai
kubectl rollout restart deployment/leary-agent -n learyai
kubectl rollout restart deployment/leary-task -n learyai
```

- dev + internal-kb：
```bash
deploy\build-dev.bat
kubectl kustomize --load-restrictor=LoadRestrictionsNone deploy/k8s/infra | kubectl apply -f -
kubectl kustomize --load-restrictor=LoadRestrictionsNone deploy/k8s/overlays/dev-internal-kb | kubectl apply -f -
kubectl rollout restart deployment/leary-backend -n learyai
kubectl rollout restart deployment/leary-agent -n learyai
kubectl rollout restart deployment/leary-task -n learyai
```

- prod + external-kb：
```bash
kubectl kustomize --load-restrictor=LoadRestrictionsNone deploy/k8s/infra | kubectl apply -f -
kubectl kustomize --load-restrictor=LoadRestrictionsNone deploy/k8s/overlays/prod-external-kb | kubectl apply -f -
```

- prod + internal-kb：
```bash
kubectl kustomize --load-restrictor=LoadRestrictionsNone deploy/k8s/infra | kubectl apply -f -
kubectl kustomize --load-restrictor=LoadRestrictionsNone deploy/k8s/overlays/prod-internal-kb | kubectl apply -f -
```

### 总入口脚本
```bash
bash deploy/k8s/provision.sh app --env dev --kb external
bash deploy/k8s/provision.sh observability
bash deploy/k8s/provision.sh gitops --env test --kb external --install-argocd
bash deploy/k8s/provision.sh backup
bash deploy/k8s/provision.sh all --env dev --kb external --with-backup
```

说明：
- `start.sh` 只负责业务应用与基础设施。
- `provision.sh` 负责按阶段收口关键部署动作：`app / observability / gitops / backup / all`。
- `all` 默认执行 `app + observability`，`backup/gitops` 需要显式开关，避免生产环境无差别全自动。
- `provision.sh app --env test --kb external` 是“手工 apply 当前本地 test overlay 到集群”，不是 test 正式发布入口；如果本地 overlay 仍保留 `test-initial`，Pod 会因为拉不到镜像而停在 `ImagePullBackOff`。
- GitOps 应用清单统一指向 `http://192.168.31.160:13001/XIAOBAI/LearyAI.git`，test 自动同步，prod 仅在 promotion 后同步。
- 安装位置约定：本机 K8s 集群只安装 `test-*` Application；`prod-*` Application 必须安装在服务器的 prod K8s 集群，不要在本机 test 集群 apply prod Application。
- 分支职责：
  - `main`：源码主线
  - `deploy/test`：test 环境 GitOps 真源，由 CI 自动更新镜像 tag；这样可以避免 CI 回写 `main` 导致开发者 push 被远端自动提交顶掉
  - `deploy/prod`：prod 环境 GitOps 真源，由 promotion 自动更新镜像 tag；这样可以避免生产发布状态回写污染源码主线 `main`
- 当前 CI/CD 生效点：
  - test：`deploy/k8s/platform/argocd/applications/test-external-kb.yaml`、`deploy/k8s/platform/argocd/applications/test-internal-kb.yaml` 监听 `deploy/test`；CI 产物落到 `deploy/k8s/scripts/update-test-image-tags.sh` 更新的 test overlay 镜像 tag，并提交到 `deploy/test`
  - prod：`deploy/k8s/platform/argocd/applications/prod-external-kb.yaml`、`deploy/k8s/platform/argocd/applications/prod-internal-kb.yaml` 监听 `deploy/prod`；审批后的 promotion workflow `.gitea/workflows/promotion.yaml` 会调用 `deploy/k8s/scripts/update-prod-image-tags.sh` 更新 prod overlay 镜像 tag，并提交到 `deploy/prod`
- test 首次引导约束：
  - `main` 分支中的 `deploy/k8s/overlays/test-*` 与 `deploy/k8s/kustomization.yaml` 只保留模板值，不承载 test 环境实际发布状态。
  - `test-initial` 只是模板占位值，不是可运行 tag。
  - test 环境首次引导时，应先在 `deploy/test` 分支写入镜像仓库中已存在的真实 commit SHA，再让 Argo CD 指向该分支同步。
  - 真实镜像需要同时覆盖：`leary-plugin-gateway`、`leary-backend`、`leary-agent`、`leary-task`。
  - `deploy/k8s/scripts/update-test-image-tags.sh` 负责在 `deploy/test` 分支上把镜像条目整行替换为新的 SHA；如果分支上的初始值被手工改坏，先修清单再让 CI 继续推进。
- prod 首次引导约束：
  - `main` 分支中的 `deploy/k8s/overlays/prod-*` 只保留模板值，不承载 prod 环境实际发布状态。
  - `prod-initial` 只是模板占位值，不是可运行 tag。
  - prod 环境首次引导时，应先在 `deploy/prod` 分支写入镜像仓库中已存在的真实 release tag，再让服务器集群的 Argo CD 指向该分支同步。
  - `deploy/k8s/scripts/update-prod-image-tags.sh` 负责在 `deploy/prod` 分支上把镜像条目整行替换为新的 tag；如果分支上的初始值被手工改坏，先修清单再让 promotion 继续推进。

## 集群内基础设施
- `deploy/k8s/infra` 现在自包含 `Namespace/learyai`，因此首次引导时可以直接独立执行 `kubectl apply -k deploy/k8s/infra`，不再依赖先 apply `base`
- PostgreSQL：`StatefulSet/leary-postgres`，镜像复用 `deploy/pg/docker/dockerfile`，由本地 Registry `192.168.31.160:15001/leary-pg:latest` 提供，首次初始化自动挂载并执行 `deploy/k8s/infra/init/*.sql`
- Redis：`StatefulSet/leary-redis`，开启 AOF 持久化
- RabbitMQ：`StatefulSet/leary-rabbitmq`，使用 management 镜像并持久化 `/var/lib/rabbitmq`
- 三者均通过 `volumeClaimTemplates` 创建 PVC，删除 Pod 不会清理数据

验证命令：
```bash
kubectl -n learyai get sts,svc,pvc
kubectl -n learyai logs statefulset/leary-postgres --tail=200
kubectl -n learyai logs statefulset/leary-redis --tail=200
kubectl -n learyai logs statefulset/leary-rabbitmq --tail=200
```

## 配置更新与重启
- `leary-task` 环境变量加载顺序：`leary-agent-config` -> `leary-agent-secret` -> `leary-task-config` -> `leary-task-secret`，与 `python-backend` 的 `.env.agent` -> `.env.task` 继承规则一致；同名变量以 `task` 配置覆盖。
- 模板预览相关地址需要同时维护后端 env 文件与前端运行时注入：
  - `LEARY_TEMPLATE_PREVIEW_BASE_URL`：模板插件预览服务外部基址，决定模板插件 `preview-entry` 和 `preview/**` 返回的地址前缀。
  - 本地联调用 `http://localhost:7999`。
- 规则 1：若 `kubectl apply -k ...` 导致 `Deployment` 的 Pod 模板发生变化（如镜像、环境变量字段、label、注解等），K8s 会自动滚动更新，无需手动重启。
- 规则 2：若仅修改 `ConfigMap/Secret` 的数据，且容器通过 `env`/`envFrom` 注入配置，已运行 Pod 不会自动刷新环境变量，需要手动重启 Deployment 以加载新值。

示例命令：
```bash
kubectl rollout restart deployment/leary-backend -n learyai
kubectl rollout restart deployment/leary-agent -n learyai
kubectl rollout restart deployment/leary-task -n learyai
```

## 可观测部署（Loki + Fluent Bit + Prometheus Operator + Grafana）
- 目录：`deploy/k8s/observability`
- 作用：
  - Loki：日志存储与查询
  - Fluent Bit：采集节点容器 stdout/stderr 并推送到 Loki
  - ServiceMonitor：声明 learyai 业务服务指标抓取规则（由 Prometheus Operator 生效）
  - Grafana：可视化查询（由 `kube-prometheus-stack` 提供 Grafana，本项目提供 datasource/dashboard 自动导入 ConfigMap）

部署命令：
```bash
# 1) 安装 Prometheus Operator（kube-prometheus-stack）
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm upgrade --install kps prometheus-community/kube-prometheus-stack \
  -n observability --create-namespace \
  -f deploy/k8s/platform/kube-prometheus-stack/values.yaml
  
# 2) 部署 Loki + Fluent Bit + ServiceMonitor + PrometheusRule + 基础设施 exporter
kubectl apply -k deploy/k8s/observability

# 统一使用脚本启动平台与观测转发
bash deploy/k8s/scripts/port-forward-platform.sh start grafana
bash deploy/k8s/scripts/port-forward-platform.sh start prometheus
bash deploy/k8s/scripts/port-forward-platform.sh start loki
```

验证命令：
```bash
kubectl -n observability get pods
kubectl -n observability get svc
kubectl -n observability logs ds/fluent-bit --tail=200
kubectl -n learyai get svc leary-backend leary-agent leary-task
kubectl -n observability get servicemonitor learyai-services
kubectl -n observability get cm | grep leary-grafana
bash deploy/k8s/scripts/port-forward-platform.sh status all
curl "http://127.0.0.1:3100/ready"
```

可选查询（本地端口转发后）：
```bash
curl -G "http://127.0.0.1:3100/loki/api/v1/query" --data-urlencode 'query={namespace="learyai"}'
```

说明：
- 当前 python-backend 已配置 `LOG_FORMAT=json` + `LOG_TO_STDOUT=1`，Fluent Bit 会直接采集容器标准输出日志。
- Loki 使用 PVC（`20Gi`）持久化，默认走集群默认 StorageClass；如需指定存储类型，请修改 `deploy/k8s/observability/loki-statefulset.yaml` 的 `volumeClaimTemplates`。
- `deploy/k8s/observability/loki-rules-configmap.yaml` 提供基础日志告警规则（Loki ruler）。
- `deploy/k8s/observability/prometheus-rules.yaml` 提供 Pod 重启、Deployment 不可用、backend 5xx、PG/Redis/RabbitMQ 风险等基础告警。
- `deploy/k8s/observability/servicemonitor-learyai.yaml` 抓取：
  - `service/leary-backend:8080` -> `/actuator/prometheus`
  - `service/leary-agent:8081` -> `/metrics`
  - `service/leary-task:8023` -> `/metrics`
- `deploy/k8s/observability/servicemonitor-infra.yaml` 抓取：
  - `service/leary-postgres-exporter:9187` -> `/metrics`
  - `service/leary-redis-exporter:9121` -> `/metrics`
  - `service/leary-rabbitmq-exporter:9419` -> `/metrics`
- 访问 Prometheus Targets：`http://127.0.0.1:9090/targets`。
- 访问 Grafana：`http://127.0.0.1:3000`（通过 `deploy/k8s/scripts/port-forward-platform.sh` 转发；账号密码默认跟随 `kube-prometheus-stack` 安装值）。
- `deploy/k8s/observability/kustomization.yaml` 会把 `deploy/k8s/observability/grafana-dashboards/*.json` 生成 `grafana_dashboard=1` 的 ConfigMap，并下发 `grafana_datasource=1` 的数据源配置。
- dashboard 统一以 `deploy/k8s/observability/grafana-dashboards` 为准进行维护。
- 若安装 chart 时关闭了 Grafana sidecar（dashboards/datasources），请在 Helm values 中开启 sidecar 才能自动导入。
- Alertmanager 基础路由由 `deploy/k8s/platform/kube-prometheus-stack/values.yaml` 管理，默认接到 blackhole/warning/critical receiver，占位后再接真实通知通道。

## 平台组件与 GitOps
- Argo CD 清单位于 `deploy/k8s/platform/argocd`：
  - `applications/test-external-kb.yaml` 默认自动同步
  - `applications/test-internal-kb.yaml` 默认自动同步
  - `applications/prod-external-kb.yaml` 默认手动同步
  - `applications/prod-internal-kb.yaml` 默认手动同步
- 安装 Argo CD 核心组件时，统一使用 `kubectl apply --server-side -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml`，避免官方大 CRD 因 client-side apply 写入超大注解而失败。
- Velero values 位于 `deploy/k8s/platform/velero/values.yaml`。
- PostgreSQL 逻辑备份模板位于 `deploy/k8s/ops/postgres-backup`。

## 外部临时连接
- `PostgreSQL`、`Redis`、`RabbitMQ` 默认不直接暴露 Ingress 或公网端口。
- `Argo CD`、`Grafana`、`Prometheus`、`Loki` 也默认不额外暴露 Ingress，统一通过脚本转发。
- 基础设施脚本：`bash deploy/k8s/scripts/port-forward-infra.sh start all`
- 平台脚本：`bash deploy/k8s/scripts/port-forward-platform.sh start all`
- 查看状态：`bash deploy/k8s/scripts/port-forward-infra.sh status all`、`bash deploy/k8s/scripts/port-forward-platform.sh status all`
- 停止转发：`bash deploy/k8s/scripts/port-forward-infra.sh stop all`、`bash deploy/k8s/scripts/port-forward-platform.sh stop all`
- 这些脚本只作为临时排障和运维入口，不替代正式的 VPN / 堡垒机 / 内网访问策略。

## 健康检查约定
- backend：
  - `startupProbe -> /actuator/health`
  - `readinessProbe -> /actuator/health/readiness`
  - `livenessProbe -> /actuator/health/liveness`
- agent：
  - `startupProbe -> /healthz/startup`
  - `readinessProbe -> /healthz/ready`
  - `livenessProbe -> /healthz/live`
- task：
  - `startupProbe -> /healthz/startup`
  - `readinessProbe -> /healthz/ready`
  - `livenessProbe -> /healthz/live`

## 切换 KB 编排版本
- dev 从 external 切到 internal：
```bash
kubectl kustomize --load-restrictor=LoadRestrictionsNone deploy/k8s/overlays/dev-internal-kb | kubectl apply -f -
```

- dev 从 internal 切到 external：
```bash
kubectl kustomize --load-restrictor=LoadRestrictionsNone deploy/k8s/overlays/dev-external-kb | kubectl apply -f -
```

- prod 从 external 切到 internal：
```bash
kubectl kustomize --load-restrictor=LoadRestrictionsNone deploy/k8s/overlays/prod-internal-kb | kubectl apply -f -
```

- prod 从 internal 切到 external：
```bash
kubectl kustomize --load-restrictor=LoadRestrictionsNone deploy/k8s/overlays/prod-external-kb | kubectl apply -f -
```

## 验证
```bash
kubectl -n learyai get deploy,svc,ingress,cm,secret
kubectl -n learyai get pods -o wide
kubectl -n learyai get sts,pvc
```

## 当前编排详情（prod-external-kb）
- 你当前执行的是：
```bash
kubectl kustomize --load-restrictor=LoadRestrictionsNone deploy/k8s/overlays/prod-external-kb | kubectl apply -f -
```
- 命名空间：`learyai`
- Ingress：`leary-ingress`（`ingressClassName: nginx`）
- Host：`learyai.example.com`（请改成你的真实域名）
- 路由转发：
  - `https://<host>/preview` -> `service/leary-plugin-gateway:7999`（模板插件独立预览入口）
  - `https://<host>/api` -> `service/leary-backend:8080`（Java HTTP API）
  - `wss://<host>/agent/ws` -> `service/leary-agent:8081`（Python agent WebSocket）
  - `https://<host>/agent/query` -> `service/leary-agent:8081`（Python agent query HTTP 提交入口）
- backend Service 端口：
  - `8080`：HTTP API（给前端和 Ingress 用）
  - `9091`：usage gRPC（集群内服务间调用）
- agent 到 backend 的集群内调用：
  - `SERVER_API_BASE_URL=http://leary-backend:8080/api`
  - `USAGE_GRPC_HOST=leary-backend`
- taskserver 到 backend 的集群内调用：
  - `TASK_MQ_STATUS_EVENT_ROUTING_KEY=task.event.status.changed`
  - `USAGE_GRPC_HOST=leary-backend`
- taskserver 服务说明：
  - 部署 `Deployment/leary-task` + `Service/leary-task`（仅用于集群内 metrics 抓取，不暴露 Ingress 路由）
  - 通过 `TASK_MQ_*` 消费 RabbitMQ 任务，并发布 `task.event.status.changed` 更新任务状态
- gRPC 端口配置：
  - 当前后端代码读取 `usage.service.grpc.port`（K8s env：`USAGE_SERVICE_GRPC_PORT`）
  - 目前编排值为 `9091`

## 前端如何访问当前集群
当前 K8s 只承载 backend/agent/plugin-gateway，因此前端访问当前集群的推荐方式是：

### 方式一：本地开发前端连接集群
适用场景：前端在本机 `vite dev`（如 `http://localhost:8000`）运行。

可选方案 A（推荐）：通过环境变量直连 Ingress
1. 在 `frontend/learyai` 下创建 `.env.local`：
```env
VITE_API_BASE_URL=https://<你的Ingress域名>/api
VITE_AGENT_WS_URL=wss://<你的Ingress域名>/agent/ws
```
2. 启动前端开发服务：
```bash
cd frontend/learyai
npm run dev
```

可选方案 B：继续使用 Vite 代理
1. 修改 `frontend/learyai/vite.config.ts` 的 `server.proxy` 目标地址（`/api`、`/agent/ws`）为当前可达的后端入口。
   `POST /agent/query` 也会随前端代理转发到同一 agent 服务。
2. 启动 `npm run dev`，前端仍请求本地 `/api`，由 Vite 转发到集群。

## 部署后快速排查
```bash
kubectl -n learyai get pods
kubectl -n learyai get ingress
kubectl -n learyai logs deploy/leary-backend --tail=200
kubectl -n learyai logs deploy/leary-agent --tail=200
kubectl -n learyai logs deploy/leary-task --tail=200
```
- 若前端 API 401/500：先检查 `deploy/k8s/components/env/<profile>/*.env` 中密钥是否正确，并重启对应 deployment。
- 若前端 WS 连接失败：优先检查 Ingress 是否支持 websocket、`/agent/ws` 路由是否生效。
- 若前端发送消息立即失败：优先检查 `/agent/query` 路由是否已转发到 `leary-agent`。
- 若任务不消费：优先检查 `TASK_MQ_*` 配置、`deploy/leary-task` 日志、以及 RabbitMQ 队列绑定。

### 快速查看最近错误日志
```bash
# 默认：namespace=learyai, since=30m, services=leary-backend/leary-agent/leary-task
bash deploy/skills/logs-analysis/scripts/logs-error.sh

# 自定义最近 1 小时
bash deploy/skills/logs-analysis/scripts/logs-error.sh --since 1h

# 自定义 namespace + 服务
bash deploy/skills/logs-analysis/scripts/logs-error.sh --ns learyai --services leary-backend,leary-task
```

脚本会输出三部分：
- 各服务按日志级别（`WARN|ERROR|FATAL|CRITICAL`）和常见异常文本过滤后的命中日志
- 按服务统计的命中行数与状态（`matched|clean|failed`）
- Top 关键词统计（便于快速定位主要问题类型）

说明：
- 脚本不会再把 JSON 字段名（如 `exception`）当作错误本身；仅在级别/异常内容命中时输出。
- 若集群不可达或 `kubectl logs` 失败，会显示 `[ERROR] <service>: kubectl logs 采集失败`，并在汇总中统计 `采集失败服务数`。
