#!/usr/bin/env bash
# 当前文件职责：为 stress-test 脚本统一加载 agent/backend 配置，并解析 PG/Redis 连接参数。

set -euo pipefail

STRESS_TEST_ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STRESS_TEST_REPO_DIR="$(cd "$STRESS_TEST_ROOT_DIR/.." && pwd)"
STRESS_TEST_AGENT_ENV_FILE="$STRESS_TEST_REPO_DIR/python-backend/.env.agent.local"
STRESS_TEST_BACKEND_PROPERTIES_FILE="$STRESS_TEST_REPO_DIR/backend/learyAI/src/main/resources/application.properties"

stress_test_load_agent_env_file() {
  if [[ ! -f "$STRESS_TEST_AGENT_ENV_FILE" ]]; then
    echo "missing env file: $STRESS_TEST_AGENT_ENV_FILE" >&2
    exit 1
  fi

  set -a
  # shellcheck disable=SC1090
  source "$STRESS_TEST_AGENT_ENV_FILE"
  set +a
}

stress_test_normalize_property_key() {
  local key="$1"
  key="${key//./_}"
  key="${key//-/_}"
  printf '%s' "${key^^}"
}

stress_test_load_backend_properties_file() {
  if [[ ! -f "$STRESS_TEST_BACKEND_PROPERTIES_FILE" ]]; then
    echo "missing properties file: $STRESS_TEST_BACKEND_PROPERTIES_FILE" >&2
    exit 1
  fi

  while IFS= read -r raw_line || [[ -n "$raw_line" ]]; do
    local line="$raw_line"
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"

    if [[ -z "$line" || "$line" == \#* || "$line" != *=* ]]; then
      continue
    fi

    local key="${line%%=*}"
    local value="${line#*=}"

    key="${key%"${key##*[![:space:]]}"}"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"

    if [[ "$value" == \"*\" && "$value" == *\" ]]; then
      value="${value:1:${#value}-2}"
    fi

    export "$(stress_test_normalize_property_key "$key")=$value"
  done < "$STRESS_TEST_BACKEND_PROPERTIES_FILE"
}

stress_test_load_defaults() {
  stress_test_load_agent_env_file
  stress_test_load_backend_properties_file
}

stress_test_parse_jdbc_url() {
  local jdbc_url="$1"
  local normalized="${jdbc_url#jdbc:postgresql://}"
  local host_port="${normalized%%/*}"
  local db_and_query="${normalized#*/}"
  local database="${db_and_query%%\?*}"
  local host="${host_port%%:*}"
  local port="${host_port##*:}"
  if [[ "$host" == "$port" ]]; then
    port="5432"
  fi
  printf '%s\n%s\n%s\n' "$host" "$port" "$database"
}

stress_test_export_connection_env() {
  local jdbc_parts
  mapfile -t jdbc_parts < <(stress_test_parse_jdbc_url "${SPRING_DATASOURCE_URL:-}")

  export STRESS_TEST_PG_HOST="${STRESS_TEST_PG_HOST:-${jdbc_parts[0]:-127.0.0.1}}"
  export STRESS_TEST_PG_PORT="${STRESS_TEST_PG_PORT:-${jdbc_parts[1]:-5432}}"
  export STRESS_TEST_PG_DATABASE="${STRESS_TEST_PG_DATABASE:-${jdbc_parts[2]:-postgres}}"
  export STRESS_TEST_PG_USER="${STRESS_TEST_PG_USER:-${SPRING_DATASOURCE_USERNAME:-postgres}}"
  export STRESS_TEST_PG_PASSWORD="${STRESS_TEST_PG_PASSWORD:-${SPRING_DATASOURCE_PASSWORD:-}}"

  export STRESS_TEST_REDIS_HOST="${STRESS_TEST_REDIS_HOST:-${SPRING_DATA_REDIS_HOST:-${AUTH_REDIS_HOST:-127.0.0.1}}}"
  export STRESS_TEST_REDIS_PORT="${STRESS_TEST_REDIS_PORT:-${SPRING_DATA_REDIS_PORT:-${AUTH_REDIS_PORT:-6379}}}"
  export STRESS_TEST_REDIS_DB="${STRESS_TEST_REDIS_DB:-${AUTH_REDIS_DB:-0}}"
  export STRESS_TEST_REDIS_PASSWORD="${STRESS_TEST_REDIS_PASSWORD:-${SPRING_DATA_REDIS_PASSWORD:-${AUTH_REDIS_PASSWORD:-}}}"
}
