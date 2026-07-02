// 该文件负责导出 arch-check workspace 包的公开 API，保持包导入路径稳定。
export { getArchitectureProfile, listArchitectureProfileNames, PROFILE_NAMES } from './src/profiles.mjs'
export { runArchitectureCheck } from './src/run-check.mjs'
