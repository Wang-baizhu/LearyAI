// 该文件负责校验 Leary module 顶层布局、跨 module 边界以及 module 内 FSD 装配规则。
import fs from 'node:fs'
import path from 'node:path'

import { CODE_FILE_REGEX, SLICE_INDEX_FILES, SLICE_ROOT_DIRS } from './constants.mjs'
import { checkSliceLayerRoot } from './fsd-rules.mjs'
import { collectImportSpecifiers, getClosestLayerName, resolveImportTarget } from './import-utils.mjs'
import {
  hasNestedSliceRootDir,
  isDirectory,
  listCodeFilesDeep,
  listDirectories,
  listDirectoriesDeep,
  listFiles,
} from './fs-utils.mjs'
import { checkSharedImports, checkSharedRoot } from './shared-rules.mjs'

function isBusinessParentDir(candidatePath) {
  const childDirs = listDirectories(candidatePath)
  const directCodeFiles = listFiles(candidatePath).filter((fileName) => CODE_FILE_REGEX.test(fileName))
  const hasLeafSegmentDirs = childDirs.some((dirName) => SLICE_ROOT_DIRS.has(dirName))
  const hasNonIndexDirectCodeFiles = directCodeFiles.some((fileName) => !SLICE_INDEX_FILES.includes(fileName))

  return !hasLeafSegmentDirs && !hasNonIndexDirectCodeFiles && childDirs.length > 0
}

function checkModuleRedundantSameNameNesting(modulePath, moduleName, moduleLayerDirs, collector) {
  for (const layerName of moduleLayerDirs) {
    const layerPath = path.join(modulePath, layerName)
    if (!isDirectory(layerPath)) {
      continue
    }

    const redundantPath = path.join(layerPath, moduleName)
    if (!isDirectory(redundantPath)) {
      continue
    }

    collector.addDiagnostic(
      `module/${layerName} 下禁止出现与 module 同名的冗余嵌套目录 "${moduleName}"，请直接在 module/${layerName} 放置 slice`,
      redundantPath,
    )
  }
}

function checkSingleBusinessFolderWarning(modulePath, layerName, sliceLayerDirs, collector) {
  if (!sliceLayerDirs.has(layerName)) {
    return
  }

  const layerPath = path.join(modulePath, layerName)
  if (!isDirectory(layerPath)) {
    return
  }

  const topLevelCodeFiles = listFiles(layerPath).filter(
    (fileName) => CODE_FILE_REGEX.test(fileName) && !SLICE_INDEX_FILES.includes(fileName),
  )
  if (topLevelCodeFiles.length > 0) {
    return
  }

  const topLevelDirs = listDirectories(layerPath)
  if (topLevelDirs.length !== 1) {
    return
  }

  const onlyBusinessDirName = topLevelDirs[0]
  const onlyBusinessDirPath = path.join(layerPath, onlyBusinessDirName)
  if (!isBusinessParentDir(onlyBusinessDirPath)) {
    return
  }

  collector.addWarning(
    `module/${layerName} 仅有一个业务目录 "${onlyBusinessDirName}"，可直接将其下级 slice 平铺到 module/${layerName}，避免无意义嵌套`,
    onlyBusinessDirPath,
  )
}

function checkNoNestedSliceRootDirs(targetPath, collector) {
  for (const dirPath of listDirectoriesDeep(targetPath)) {
    const dirName = path.basename(dirPath)
    if (!SLICE_ROOT_DIRS.has(dirName)) {
      continue
    }

    if (!hasNestedSliceRootDir(dirPath)) {
      continue
    }

    collector.addDiagnostic(`${dirName} 目录下禁止继续嵌套 ui/model/api/lib/config`, dirPath)
  }
}

function isCrossModuleImport(moduleName, targetPath, modulesRoot) {
  if (targetPath === null) {
    return false
  }

  const relativeToModules = path.relative(modulesRoot, targetPath)
  if (relativeToModules.startsWith('..') || path.isAbsolute(relativeToModules)) {
    return false
  }

  const [targetModuleName] = relativeToModules.split(path.sep)
  return Boolean(targetModuleName) && targetModuleName !== moduleName
}

function isCrossModulePublicImport(moduleName, targetPath, modulesRoot) {
  if (!isCrossModuleImport(moduleName, targetPath, modulesRoot)) {
    return false
  }

  const relativeToModules = path.relative(modulesRoot, targetPath)
  const [targetModuleName, ...restSegments] = relativeToModules.split(path.sep)
  if (!targetModuleName) {
    return false
  }

  const targetModulePath = path.join(modulesRoot, targetModuleName)
  const normalizedTargetPath = path.normalize(targetPath)
  const moduleIndexPath = path.join(targetModulePath, 'index.ts')
  const moduleTsxIndexPath = path.join(targetModulePath, 'index.tsx')
  const restPath = restSegments.join(path.sep)

  if (normalizedTargetPath === targetModulePath) {
    return true
  }

  if (normalizedTargetPath === moduleIndexPath || normalizedTargetPath === moduleTsxIndexPath) {
    return true
  }

  return restPath === 'index.ts' || restPath === 'index.tsx'
}

function checkCrossModuleImports(modulePath, moduleName, runtime, collector) {
  for (const filePath of listCodeFilesDeep(modulePath)) {
    for (const specifier of collectImportSpecifiers(filePath)) {
      const targetPath = resolveImportTarget(filePath, specifier, runtime)
      if (!isCrossModuleImport(moduleName, targetPath, runtime.profile.moduleLayout.modulesRoot)) {
        continue
      }

      if (isCrossModulePublicImport(moduleName, targetPath, runtime.profile.moduleLayout.modulesRoot)) {
        continue
      }

      collector.addDiagnostic('跨 module 依赖只能引用目标 module 的公开出口，不允许穿透内部实现文件', filePath)
      break
    }
  }
}

function checkModule(modulePath, runtime, collector) {
  const { knownLayerNames, profile } = runtime
  const { moduleExtraDirs, moduleLayerDirs, modulesRoot, sharedInvalidDependencyLayerNames, sliceLayerDirs } =
    profile.moduleLayout
  const moduleAllowedTopDirs = new Set([...moduleLayerDirs, ...moduleExtraDirs, 'docs'])
  const moduleName = path.basename(modulePath)
  const moduleIndexPath = path.join(modulePath, 'index.ts')

  if (!fs.existsSync(moduleIndexPath)) {
    collector.addDiagnostic('module 缺少公开出口 index.ts', modulePath)
  }

  for (const topDirName of listDirectories(modulePath)) {
    const topDirPath = path.join(modulePath, topDirName)
    if (!moduleAllowedTopDirs.has(topDirName)) {
      const hint = getClosestLayerName(topDirName, knownLayerNames)
      if (hint !== null) {
        collector.addDiagnostic(`module 顶层目录 "${topDirName}" 可能是层名拼写错误，建议 "${hint.name}"`, topDirPath)
      } else {
        collector.addDiagnostic(`module 顶层目录 "${topDirName}" 不在允许列表中`, topDirPath)
      }
    }
  }

  checkModuleRedundantSameNameNesting(modulePath, moduleName, moduleLayerDirs, collector)
  for (const layerName of moduleLayerDirs) {
    checkSingleBusinessFolderWarning(modulePath, layerName, sliceLayerDirs, collector)
  }

  for (const layerName of moduleLayerDirs) {
    const layerPath = path.join(modulePath, layerName)
    if (!isDirectory(layerPath)) {
      continue
    }

    if (layerName === 'shared') {
      checkSharedRoot(layerPath, collector)
      checkSharedImports(
        layerPath,
        sharedInvalidDependencyLayerNames.map((name) => path.join(modulePath, name)),
        'module 内 shared 禁止依赖 pages/widgets/features/entities/adapter 业务层代码',
        runtime,
        collector,
      )
      continue
    }

    if (sliceLayerDirs.has(layerName)) {
      checkSliceLayerRoot(layerPath, collector)
    }
  }

  const adapterPath = path.join(modulePath, 'adapter')
  if (isDirectory(adapterPath)) {
    checkNoNestedSliceRootDirs(adapterPath, collector)
  }
  checkCrossModuleImports(modulePath, moduleName, runtime, collector)
}

export function checkModuleLayout(runtime, collector) {
  const { modulesRoot } = runtime.profile.moduleLayout
  if (!isDirectory(modulesRoot)) {
    return
  }

  for (const moduleName of listDirectories(modulesRoot)) {
    checkModule(path.join(modulesRoot, moduleName), runtime, collector)
  }
}
