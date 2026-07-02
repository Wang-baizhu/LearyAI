#!/usr/bin/env bash
# run-android.sh 负责同步前端资源并以开发服务 URL 启动 Android 调试包。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DEFAULT_ANDROID_SDK_ROOT="/mnt/i/Tools/SDK"
DEFAULT_CAP_SERVER_URL="http://192.168.31.160:8000"
SDK_COMPAT_ROOT="/tmp/leary-android-sdk-compat"

export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-${DEFAULT_ANDROID_SDK_ROOT}}}"
export ANDROID_HOME="${ANDROID_HOME:-${ANDROID_SDK_ROOT}}"
export CAPACITOR_ANDROID_STUDIO_PATH="${CAPACITOR_ANDROID_STUDIO_PATH:-}"
# WARN: 这里默认注入的是开发服务地址，仅用于真机调试，不是原生包最终加载方式。
export CAP_SERVER_URL="${CAP_SERVER_URL:-${DEFAULT_CAP_SERVER_URL}}"
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-${PROJECT_ROOT}/.gradle}"

if [[ ! -d "${ANDROID_SDK_ROOT}" ]]; then
  echo "Android SDK 不存在: ${ANDROID_SDK_ROOT}" >&2
  echo "请先设置 ANDROID_SDK_ROOT 或 ANDROID_HOME 指向可用的 Android SDK。" >&2
  exit 1
fi

mkdir -p "${GRADLE_USER_HOME}"

if [[ -x "${ANDROID_SDK_ROOT}/platform-tools/adb" ]]; then
  ADB_BIN="${ANDROID_SDK_ROOT}/platform-tools/adb"
elif [[ -x "${ANDROID_SDK_ROOT}/platform-tools/adb.exe" ]]; then
  ADB_BIN="${ANDROID_SDK_ROOT}/platform-tools/adb.exe"
else
  echo "未找到可用的 adb，可检查 ${ANDROID_SDK_ROOT}/platform-tools。" >&2
  exit 1
fi

if [[ "${ADB_BIN}" == *.exe ]]; then
  rm -rf "${SDK_COMPAT_ROOT}"
  mkdir -p "${SDK_COMPAT_ROOT}"
  for sdk_entry in "${ANDROID_SDK_ROOT}"/*; do
    sdk_name="$(basename "${sdk_entry}")"
    if [[ "${sdk_name}" == "platform-tools" ]]; then
      continue
    fi
    ln -sfn "${sdk_entry}" "${SDK_COMPAT_ROOT}/${sdk_name}"
  done

  mkdir -p "${SDK_COMPAT_ROOT}/platform-tools"
  for tool_entry in "${ANDROID_SDK_ROOT}/platform-tools"/*; do
    tool_name="$(basename "${tool_entry}")"
    if [[ "${tool_name}" == "adb" ]]; then
      continue
    fi
    ln -sfn "${tool_entry}" "${SDK_COMPAT_ROOT}/platform-tools/${tool_name}"
  done
  ADB_WRAPPER_PATH="${SDK_COMPAT_ROOT}/platform-tools/adb"
  printf '#!/usr/bin/env bash\nset -o pipefail\n"%s" "$@" 2> >(tr -d "\\r" >&2) | tr -d "\\r"\nexit ${PIPESTATUS[0]}\n' "${ADB_BIN}" > "${ADB_WRAPPER_PATH}"
  chmod +x "${ADB_WRAPPER_PATH}"

  export ANDROID_SDK_ROOT="${SDK_COMPAT_ROOT}"
  export ANDROID_HOME="${SDK_COMPAT_ROOT}"
  ADB_BIN="${ADB_WRAPPER_PATH}"
fi

export PATH="${ANDROID_SDK_ROOT}/platform-tools:${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin:${ANDROID_SDK_ROOT}/emulator:${PATH}"

# 避免 VS Code / Node 调试注入污染 native-run 的 JSON 输出。
unset NODE_OPTIONS
unset VSCODE_INSPECTOR_OPTIONS
unset ELECTRON_RUN_AS_NODE

"${ADB_BIN}" start-server >/dev/null
"${ADB_BIN}" devices

pnpm build:native
pnpm exec cap sync android
cd "${PROJECT_ROOT}"
pnpm exec cap run android
