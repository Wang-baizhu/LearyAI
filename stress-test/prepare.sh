#!/usr/bin/env bash
# 当前文件职责：自动清理 stress-test 相关 PG/Redis usage 状态，并重新初始化压测测试用户额度。

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$ROOT_DIR/.." && pwd)"

# shellcheck disable=SC1091
source "$ROOT_DIR/lib/env.sh"

USER_ID_MIN="${STRESS_TEST_PREPARE_USER_ID_MIN:-1}"
USER_ID_MAX="${STRESS_TEST_PREPARE_USER_ID_MAX:-100}"
INIT_QUOTA="${STRESS_TEST_INIT_QUOTA:-15000}"
PG_CONTAINER="${STRESS_TEST_PG_CONTAINER:-leary-pg}"
REDIS_CONTAINER="${STRESS_TEST_REDIS_CONTAINER:-leary-redis}"
PG_EXEC_HOST="${STRESS_TEST_PG_EXEC_HOST:-127.0.0.1}"
REDIS_EXEC_HOST="${STRESS_TEST_REDIS_EXEC_HOST:-127.0.0.1}"

require_command() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "$name is required but not installed" >&2
    exit 1
  fi
}

docker_exec_psql() {
  local sql_file_path="$1"
  shift
  docker exec -i \
    -e "PGPASSWORD=$STRESS_TEST_PG_PASSWORD" \
    "$PG_CONTAINER" \
    psql \
    -h "$PG_EXEC_HOST" \
    -p "$STRESS_TEST_PG_PORT" \
    -U "$STRESS_TEST_PG_USER" \
    -d "$STRESS_TEST_PG_DATABASE" \
    -v "ON_ERROR_STOP=1" \
    "$@" \
    -f - < "$sql_file_path"
}

docker_exec_redis_cli() {
  local docker_args=(docker exec)
  if [[ -n "$STRESS_TEST_REDIS_PASSWORD" ]]; then
    docker_args+=(-e "REDISCLI_AUTH=$STRESS_TEST_REDIS_PASSWORD")
  fi
  docker_args+=("$REDIS_CONTAINER" redis-cli "$@")
  "${docker_args[@]}"
}

delete_redis_pattern() {
  local pattern="$1"
  docker exec "$REDIS_CONTAINER" sh -lc "
    export REDISCLI_AUTH='$STRESS_TEST_REDIS_PASSWORD'
    redis-cli -h '$REDIS_EXEC_HOST' -p '$STRESS_TEST_REDIS_PORT' -n '$STRESS_TEST_REDIS_DB' --scan --pattern '$pattern' |
    while IFS= read -r key; do
      if [ -n \"\$key\" ]; then
        redis-cli -h '$REDIS_EXEC_HOST' -p '$STRESS_TEST_REDIS_PORT' -n '$STRESS_TEST_REDIS_DB' DEL \"\$key\" >/dev/null
      fi
    done
  "
}

reset_usage_redis_state() {
  echo "[prepare] clearing redis usage state: container=$REDIS_CONTAINER host=$STRESS_TEST_REDIS_HOST port=$STRESS_TEST_REDIS_PORT db=$STRESS_TEST_REDIS_DB"
  delete_redis_pattern 'usage:*'
}

reset_usage_tables() {
  echo "[prepare] clearing usage tables: container=$PG_CONTAINER host=$STRESS_TEST_PG_HOST port=$STRESS_TEST_PG_PORT db=$STRESS_TEST_PG_DATABASE user_range=${USER_ID_MIN}-${USER_ID_MAX}"
  docker_exec_psql \
    "$REPO_DIR/scripts/sql/reset_stress_usage_state.sql" \
    -v "user_id_min=$USER_ID_MIN" \
    -v "user_id_max=$USER_ID_MAX"
}

init_stress_users() {
  echo "[prepare] initializing stress test users and quota=${INIT_QUOTA}"
  docker_exec_psql \
    "$REPO_DIR/scripts/sql/init_stress_test.sql" \
    -v "quota=$INIT_QUOTA" \
    -v "user_id_min=$USER_ID_MIN" \
    -v "user_id_max=$USER_ID_MAX"
}

print_connection_summary() {
  echo "[prepare] postgres: container=${PG_CONTAINER} ${STRESS_TEST_PG_USER}@${STRESS_TEST_PG_HOST}:${STRESS_TEST_PG_PORT}/${STRESS_TEST_PG_DATABASE}"
  echo "[prepare] postgres exec host: ${PG_EXEC_HOST}"
  echo "[prepare] redis: container=${REDIS_CONTAINER} ${STRESS_TEST_REDIS_HOST}:${STRESS_TEST_REDIS_PORT}/${STRESS_TEST_REDIS_DB}"
  echo "[prepare] redis exec host: ${REDIS_EXEC_HOST}"
}

main() {
  require_command docker

  stress_test_load_defaults
  stress_test_export_connection_env
  print_connection_summary
  reset_usage_redis_state
  reset_usage_tables
  init_stress_users
  echo "[prepare] done"
}

main "$@"
