// 该文件负责基于 profile 构建架构校验运行时上下文。
export function createRuntime(profile) {
  return {
    profile,
    knownLayerNames: profile.knownLayerNames,
    importResolver: profile.importResolver,
  }
}
