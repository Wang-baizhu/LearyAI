// 该文件负责根据 profile 校验 app 层与全局目录的顶层架构约束。
import path from 'node:path'

import { isDirectory } from './fs-utils.mjs'
import { checkSharedImports, checkSharedRoot } from './shared-rules.mjs'

export function checkAppRules(runtime, collector) {
  const { appRules, sharedRoots } = runtime.profile

  for (const deprecatedLayerName of appRules.deprecatedLayerNames) {
    const deprecatedLayerPath = path.join(runtime.importResolver.srcRoot, deprecatedLayerName)
    if (isDirectory(deprecatedLayerPath)) {
      collector.addDiagnostic(`禁止使用已废弃的 ${deprecatedLayerName} 层`, deprecatedLayerPath)
    }
  }

  if (appRules.forbidAppUi) {
    const appUiDir = path.join(appRules.appRoot, 'ui')
    if (isDirectory(appUiDir)) {
      collector.addDiagnostic('app 层禁止出现 ui 目录', appUiDir)
    }
  }

  for (const sharedRootConfig of sharedRoots) {
    if (!isDirectory(sharedRootConfig.path)) {
      continue
    }

    checkSharedRoot(sharedRootConfig.path, collector)
    if (sharedRootConfig.invalidDependencyRoots.length === 0) {
      continue
    }

    checkSharedImports(
      sharedRootConfig.path,
      sharedRootConfig.invalidDependencyRoots,
      sharedRootConfig.invalidDependencyMessage,
      runtime,
      collector,
    )
  }
}
