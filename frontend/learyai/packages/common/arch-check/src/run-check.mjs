// 该文件负责按 profile 装配架构校验规则并返回校验结果。
import { checkAppRules } from './app-rules.mjs'
import { createCollector } from './collector.mjs'
import { checkSliceLayerRoots } from './fsd-rules.mjs'
import { checkModuleLayout } from './module-layout-rules.mjs'
import { getArchitectureProfile } from './profiles.mjs'
import { createRuntime } from './runtime.mjs'

export function runArchitectureCheck(profileName, options = {}) {
  const runtime = createRuntime(getArchitectureProfile(profileName, options))
  const collector = createCollector()

  checkAppRules(runtime, collector)
  checkSliceLayerRoots(runtime.profile.sliceLayerRoots, collector)
  if (runtime.profile.moduleLayout !== null) {
    checkModuleLayout(runtime, collector)
  }

  return {
    diagnostics: collector.diagnostics,
    warnings: collector.warnings,
    profile: runtime.profile.name,
  }
}
