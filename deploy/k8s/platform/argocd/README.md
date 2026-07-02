# 当前文件职责：说明 learyAI 的 Argo CD 安装与 Application 约定。

## 安装
```bash
kubectl create namespace argocd
kubectl apply --server-side -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# 本机 test 集群
kubectl apply -f deploy/k8s/platform/argocd/applications/test-external-kb.yaml
kubectl apply -f deploy/k8s/platform/argocd/applications/test-internal-kb.yaml

# 服务器 prod 集群
kubectl apply -f deploy/k8s/platform/argocd/applications/prod-external-kb.yaml
kubectl apply -f deploy/k8s/platform/argocd/applications/prod-internal-kb.yaml
```

说明：
- Argo CD 官方 `install.yaml` 包含大体积 CRD，直接执行 client-side `kubectl apply` 容易因 `last-applied-configuration` 注解过大触发 `metadata.annotations: Too long`。
- 这里统一使用 `--server-side`，避免首次引导时安装失败。
- 默认不额外暴露 Argo CD Ingress；如需本机访问，使用 `bash deploy/k8s/scripts/port-forward-platform.sh start argocd`。

## 约定
- `test-external-kb`：默认自动同步，作为首个 GitOps 验证环境。
- `test-internal-kb`：默认自动同步，供集群内 KB 编排验证使用。
- `prod-external-kb`：默认手动同步，作为生产主路径示例。
- `prod-internal-kb`：默认手动同步，供集群内 KB 生产编排使用。
- `test-external-kb` / `test-internal-kb` 的 Argo CD source path 指向各自 overlay，直接读取 `deploy/k8s/overlays/test-*`，避免 Kustomize 在缓存目录里拒绝跨目录引用。
- `test-*` Application 统一跟踪 `deploy/test`，原因是 test 镜像 tag 会被 CI 自动回写；把发布状态放在独立分支可以避免 CI 持续推进 `main` 干扰开发者提交。
- `prod-*` Application 统一跟踪 `deploy/prod`，原因是 prod 镜像 tag 会被 promotion 自动回写；把生产发布状态放在独立分支可以避免回写污染源码主线 `main`。
- `prod-*` Application 设计为安装在服务器 prod 集群，不应和本机 test 集群共用同一套 Argo CD 安装实例。
- `IMAGE_REGISTRY` 推荐值：`192.168.31.160:15001`
- `REPO_HTTP_URL` 推荐值：`http://192.168.31.160:13001/XIAOBAI/LearyAI.git`
- 发布流程：
  - test：CI 产出镜像 -> `deploy/k8s/scripts/update-test-image-tags.sh` 更新 test overlay 镜像 tag -> 推送到 `deploy/test` -> Argo CD 自动同步 test 环境
  - prod：test 验证通过后，在 Gitea UI 发布 Release 作为审批入口，`release.published` 触发 `.gitea/workflows/promotion.yaml`，由 `deploy/k8s/scripts/update-prod-image-tags.sh` 更新 prod overlay 镜像 tag并推送到 `deploy/prod` -> 服务器集群中的 Argo CD 同步 prod 环境
  - 说明：当前 Gitea Actions 不支持 `workflow_dispatch`，所以用 Release 发布动作替代“按钮式”手工触发
