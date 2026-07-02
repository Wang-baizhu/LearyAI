#!/usr/bin/env bash
# 该文件职责：从 backend task Java contract 导出 task.command.agent.run JSON Schema。

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend/learyAI"
SCHEMA_OUT="$ROOT_DIR/schema/task/task.command.agent.run.schema.json"
CLASSPATH_FILE="/tmp/leary-task-schema.cp"

mkdir -p "$(dirname "$SCHEMA_OUT")"

(
  cd "$BACKEND_DIR"
  ./mvnw -q -DskipTests compile dependency:build-classpath -Dmdep.outputFile="$CLASSPATH_FILE"
  java -cp "target/classes:$(cat "$CLASSPATH_FILE")" \
    com.notebook.learyAI.module.task.contract.command.TaskAgentCommandSchemaExporter \
    > "$SCHEMA_OUT"
)
