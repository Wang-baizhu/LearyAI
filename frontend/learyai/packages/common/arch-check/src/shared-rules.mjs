// 该文件负责校验 shared 层目录结构与依赖边界。
import path from 'node:path'

import {
  CODE_FILE_REGEX,
  DOCS_DIR_NAME,
  SHARED_ROOT_ALLOWED_FILES,
  SHARED_TOP_LEVEL_DIRS,
  TEST_DIR_NAME,
} from './constants.mjs'
import { hasNestedDirectoryNamed, listCodeFilesDeep, listDirectories, listFiles, isDirectory } from './fs-utils.mjs'
import { collectImportSpecifiers, resolveImportTarget } from './import-utils.mjs'

function checkSharedTestsDirectory(testsPath, collector) {
  const implementationDirPath = path.dirname(testsPath)
  const implementationFiles = listFiles(implementationDirPath).filter((fileName) => CODE_FILE_REGEX.test(fileName))
  if (implementationFiles.length === 0) {
    collector.addDiagnostic('shared/__tests__ 同级必须直接存在业务实现文件', testsPath)
  }

  const nestedDirs = listDirectories(testsPath)
  if (nestedDirs.length > 0) {
    collector.addDiagnostic('shared/__tests__ 下不允许继续嵌套目录', testsPath)
  }
}

function checkSharedNestedTests(targetPath, collector) {
  for (const dirName of listDirectories(targetPath)) {
    const childPath = path.join(targetPath, dirName)
    if (dirName === TEST_DIR_NAME) {
      checkSharedTestsDirectory(childPath, collector)
      continue
    }
    checkSharedNestedTests(childPath, collector)
  }
}

export function checkSharedRoot(sharedPath, collector) {
  const directCodeFiles = listFiles(sharedPath).filter(
    (fileName) => CODE_FILE_REGEX.test(fileName) && !SHARED_ROOT_ALLOWED_FILES.has(fileName),
  )
  if (directCodeFiles.length > 0) {
    collector.addDiagnostic(
      `shared 根目录只允许存在 ${Array.from(SHARED_ROOT_ALLOWED_FILES).join('/')}，其他实现文件必须放入允许的职责目录`,
      sharedPath,
    )
  }

  const invalidTopDirs = listDirectories(sharedPath).filter(
    (dirName) => dirName !== DOCS_DIR_NAME && !SHARED_TOP_LEVEL_DIRS.has(dirName),
  )
  if (invalidTopDirs.length > 0) {
    collector.addDiagnostic(
      `shared 顶层目录只允许 ${Array.from(SHARED_TOP_LEVEL_DIRS).join('/')}，发现非法目录: ${invalidTopDirs.join(', ')}`,
      sharedPath,
    )
  }

  const sharedApiPath = path.join(sharedPath, 'api')
  if (isDirectory(sharedApiPath)) {
    const invalidApiSubDirs = listDirectories(sharedApiPath).filter((dirName) => dirName !== TEST_DIR_NAME)
    if (invalidApiSubDirs.length > 0) {
      collector.addDiagnostic(
        'shared/api 下不允许出现业务子目录，只允许直接放置 API 文件；测试目录请使用 __tests__',
        sharedApiPath,
      )
    }
  }

  for (const topLevelDirName of listDirectories(sharedPath).filter((dirName) => SHARED_TOP_LEVEL_DIRS.has(dirName))) {
    const topLevelDirPath = path.join(sharedPath, topLevelDirName)
    if (!hasNestedDirectoryNamed(topLevelDirPath, topLevelDirName)) {
      continue
    }

    collector.addDiagnostic(`shared/${topLevelDirName} 禁止出现同名目录重复嵌套`, topLevelDirPath)
  }

  checkSharedNestedTests(sharedPath, collector)
}

export function checkSharedImports(sharedPath, invalidDependencyRoots, message, runtime, collector) {
  for (const filePath of listCodeFilesDeep(sharedPath)) {
    for (const specifier of collectImportSpecifiers(filePath)) {
      const targetPath = resolveImportTarget(filePath, specifier, runtime)
      if (targetPath === null) {
        continue
      }

      if (
        invalidDependencyRoots.some(
          (rootPath) => targetPath === rootPath || targetPath.startsWith(`${rootPath}${path.sep}`),
        )
      ) {
        collector.addDiagnostic(message, filePath)
        break
      }
    }
  }
}
