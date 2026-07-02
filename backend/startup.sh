# 当前文件职责：在仓库根目录启动 Java 后端，并把启动日志落到 backend/learyAI/logs。
#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/home/bai/projects/learyAI/backend/learyAI"
LOG_DIR="${PROJECT_DIR}/logs"
LOG_FILE="${LOG_DIR}/backend-startup.log"

mkdir -p "${LOG_DIR}"

cd "${PROJECT_DIR}"
STATUS=0
./mvnw spring-boot:run >>"${LOG_FILE}" 2>&1 || STATUS=$?
printf '[%s] backend/startup.sh exit status=%s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "${STATUS}" >>"${LOG_FILE}"
exit "${STATUS}"
