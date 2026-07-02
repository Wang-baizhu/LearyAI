# 当前文件职责：说明 learyAI 在仓库内维护的 Gitea、Registry、act_runner 与 runner 执行镜像编排方式。

## 目录说明
- `docker-compose.gitea.yml`：Gitea 编排
- `docker-compose.registry.yml`：Docker Registry 编排
- `docker-compose.runner.yml`：Gitea act_runner 编排
- `.env.runner.example`：runner 注册与标签示例
- `runner-image/`：Gitea Actions job 执行镜像构建目录，预装 Java、Node、pnpm、uv
- `config.runner.template.yaml`：act_runner 运行时配置模板，用于把宿主机 `uv` 缓存挂到每个 job 容器，并把该宿主机路径加入 `valid_volumes`
- `bin/`：启动、停止、查看日志、构建 runner job 镜像脚本
- `data/`：运行期数据目录，已通过根目录 `.gitignore` 忽略

## 启动顺序
在仓库根目录执行：

```bash
cd deploy/ci-infra
cp .env.runner.example .env.runner
```

先按实际环境修改 `.env.runner` 中的：
- `GITEA_INSTANCE_URL`
- `GITEA_RUNNER_REGISTRATION_TOKEN`
- `GITEA_RUNNER_NAME`
- `GITEA_RUNNER_LABELS`

## 构建 runner job 镜像
在 `deploy/ci-infra` 目录执行：

```bash
bash bin/build-runner-job-image.sh 192.168.31.160:15001/leary-runner-job:ubuntu-latest --push
```

说明：
- 该镜像基于 `gitea/runner-images:ubuntu-latest`
- 额外预装 `Java 17`、`Node 22`、`pnpm 10.30.3`、`uv`
- 推送完成后，把 `.env.runner` 中的 `GITEA_RUNNER_LABELS` 指向该镜像

## 启动服务
启动 Gitea：

```bash
cd deploy/ci-infra
bash bin/start-gitea.sh
```

启动 Registry：

```bash
cd deploy/ci-infra
bash bin/start-registry.sh
```

启动 act_runner：

```bash
cd deploy/ci-infra
bash bin/start-runner.sh
```

说明：
- 启动脚本会生成 `data/act_runner/config.yaml`
- 并自动创建 `data/act_runner/uv-cache/`
- 之后每个 job 容器都会把宿主机上的 `uv-cache` 目录挂载到容器内 `/tmp/uv-cache`
- 同时会把该宿主机路径加入 `container.valid_volumes`，避免 act_runner 将缓存挂载忽略
- 启动脚本会强制重建 `act-runner` 服务，确保新的 `config.yaml` 被主进程重新加载

## 查看日志
```bash
cd deploy/ci-infra
bash bin/logs-gitea.sh
bash bin/logs-registry.sh
bash bin/logs-runner.sh
```

## 停止服务
```bash
cd deploy/ci-infra
bash bin/stop-gitea.sh
bash bin/stop-registry.sh
bash bin/stop-runner.sh
```

## 当前链路约定
- Gitea Web：`http://localhost:13001`
- Gitea SSH：`localhost:2222`
- Registry：`http://192.168.31.160:15001/v2/`
- runner 访问 Gitea：优先使用 `http://host.docker.internal:13001/`
- workflow 中的 `runs-on: ubuntu-latest` 会映射到 `GITEA_RUNNER_LABELS` 指定的自定义 job 镜像
- Python CI 依赖缓存改为复用 runner 宿主机 `data/act_runner/uv-cache/`，不再依赖 `actions/cache` 回填 `/tmp/uv-cache`

## 数据与安全
- `data/` 与真实 `.env.runner` 不纳入版本控制
- `act_runner` 通过挂载 `/var/run/docker.sock` 执行 job，仅适合当前自管环境
- 若注册 token 已在不安全场景暴露，迁移完成后请重新签发并替换

## 迁移建议
- 旧目录 `/home/bai/Deploy/learyAI` 中的 compose、bin、README 可以停止继续维护
- 真实运行入口切换到仓库内 `deploy/ci-infra`
- 若需要保留旧数据，可把旧目录下的 `data/` 搬到 `deploy/ci-infra/data/`
