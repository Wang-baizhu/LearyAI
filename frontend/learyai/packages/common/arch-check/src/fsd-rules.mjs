// 该文件负责校验通用 FSD slice 的内部结构，不依赖具体项目的顶层模块布局。
import fs from 'node:fs'
import path from 'node:path'

import {
  CODE_FILE_REGEX,
  DOCS_DIR_NAME,
  MODEL_ROOT_FILE_WARN_THRESHOLD,
  SLICE_INDEX_FILES,
  SLICE_ROOT_DIRS,
  TEST_DIR_NAME,
} from './constants.mjs'
import {
  collectSlicePaths,
  hasNestedDirectoryNamed,
  hasNestedSliceRootDir,
  isDirectory,
  listDirectories,
  listFiles,
} from './fs-utils.mjs'

function checkSliceStructure(slicePath, collector) {
  const directCodeFiles = listFiles(slicePath).filter(
    (fileName) => CODE_FILE_REGEX.test(fileName) && !SLICE_INDEX_FILES.includes(fileName),
  )
  const childDirs = listDirectories(slicePath)
  const hasLeafSegmentDirs = childDirs.some((dirName) => SLICE_ROOT_DIRS.has(dirName))

  if (directCodeFiles.length > 0) {
    collector.addDiagnostic(
      'slice 根目录只允许存在 index.ts/index.tsx，其他实现文件必须放入 ui/model/api/lib/config',
      slicePath,
    )
  }

  const invalidLeafDirs = childDirs.filter(
    (dirName) => dirName !== DOCS_DIR_NAME && !SLICE_ROOT_DIRS.has(dirName),
  )
  if (invalidLeafDirs.length > 0) {
    collector.addDiagnostic(
      `slice 根目录只允许 ui/model/api/lib/config 目录，发现非法目录: ${invalidLeafDirs.join(', ')}`,
      slicePath,
    )
  }

  const hasSliceIndex = SLICE_INDEX_FILES.some((indexFile) => fs.existsSync(path.join(slicePath, indexFile)))
  if ((hasLeafSegmentDirs || directCodeFiles.length > 0) && !hasSliceIndex) {
    collector.addDiagnostic('有代码的叶子 slice 缺少公开出口 index.ts/index.tsx', slicePath)
  }
}

function checkSliceSegments(slicePath, collector) {
  const childDirs = listDirectories(slicePath)

  for (const segmentDirName of childDirs.filter((dirName) => SLICE_ROOT_DIRS.has(dirName))) {
    const segmentPath = path.join(slicePath, segmentDirName)
    if (hasNestedDirectoryNamed(segmentPath, segmentDirName)) {
      collector.addDiagnostic(`slice/${segmentDirName} 禁止出现同名目录重复嵌套`, segmentPath)
    }
    if (hasNestedSliceRootDir(segmentPath)) {
      collector.addDiagnostic(`slice/${segmentDirName} 下禁止继续嵌套 ui/model/api/lib/config`, segmentPath)
    }
  }
}

function checkTestsDirectory(testsPath, collector, messagePrefix) {
  const implementationDirPath = path.dirname(testsPath)
  const implementationFiles = listFiles(implementationDirPath).filter(
    (fileName) => CODE_FILE_REGEX.test(fileName) && !SLICE_INDEX_FILES.includes(fileName),
  )
  if (implementationFiles.length === 0) {
    collector.addDiagnostic(`${messagePrefix}/__tests__ 同级必须直接存在业务实现文件`, testsPath)
  }

  const nestedDirs = listDirectories(testsPath)
  if (nestedDirs.length > 0) {
    collector.addDiagnostic(`${messagePrefix}/__tests__ 下不允许继续嵌套目录`, testsPath)
  }
}

function checkFileContainerDepth(containerPath, collector, messagePrefix) {
  const invalidDirs = listDirectories(containerPath).filter(
    (dirName) => dirName !== TEST_DIR_NAME && dirName !== DOCS_DIR_NAME,
  )
  if (invalidDirs.length > 0) {
    collector.addDiagnostic(
      `${messagePrefix} 只允许直接文件和 __tests__，发现非法目录: ${invalidDirs.join(', ')}`,
      containerPath,
    )
  }

  const testsPath = path.join(containerPath, TEST_DIR_NAME)
  if (isDirectory(testsPath)) {
    checkTestsDirectory(testsPath, collector, messagePrefix)
  }
}

function checkGenericSegmentDepth(slicePath, segmentDirName, collector) {
  const segmentPath = path.join(slicePath, segmentDirName)
  const childDirs = listDirectories(segmentPath)

  for (const childDirName of childDirs) {
    if (childDirName === TEST_DIR_NAME) {
      checkTestsDirectory(path.join(segmentPath, childDirName), collector, `slice/${segmentDirName}`)
      continue
    }
    if (childDirName === DOCS_DIR_NAME) {
      continue
    }

    checkFileContainerDepth(path.join(segmentPath, childDirName), collector, `slice/${segmentDirName}/${childDirName}`)
  }
}

function checkSliceModel(slicePath, collector) {
  const modelPath = path.join(slicePath, 'model')
  if (!isDirectory(modelPath)) {
    return
  }

  const modelRootCodeFiles = listFiles(modelPath).filter(
    (fileName) => CODE_FILE_REGEX.test(fileName) && !SLICE_INDEX_FILES.includes(fileName),
  )
  if (modelRootCodeFiles.length > MODEL_ROOT_FILE_WARN_THRESHOLD) {
    collector.addWarning(
      `slice/model 根目录代码文件数为 ${modelRootCodeFiles.length}，建议拆分到 hooks/store/actions/selectors/effects/types 子目录`,
      modelPath,
    )
  }

  const modelTestsPath = path.join(modelPath, TEST_DIR_NAME)
  if (isDirectory(modelTestsPath)) {
    checkTestsDirectory(modelTestsPath, collector, 'slice/model')
  }

  for (const modelDirName of listDirectories(modelPath).filter(
    (dirName) => dirName !== TEST_DIR_NAME && dirName !== DOCS_DIR_NAME,
  )) {
    const modelDirPath = path.join(modelPath, modelDirName)
    if (hasNestedDirectoryNamed(modelDirPath, modelDirName)) {
      collector.addDiagnostic(`slice/model/${modelDirName} 禁止出现同名目录重复嵌套`, modelDirPath)
    }
    checkFileContainerDepth(modelDirPath, collector, `slice/model/${modelDirName}`)
  }
}

export function checkSliceLayerRoot(layerRootPath, collector) {
  if (!isDirectory(layerRootPath)) {
    return
  }

  for (const slicePath of collectSlicePaths(layerRootPath)) {
    checkSliceStructure(slicePath, collector)
    checkSliceSegments(slicePath, collector)
    for (const segmentDirName of listDirectories(slicePath).filter(
      (dirName) => SLICE_ROOT_DIRS.has(dirName) && dirName !== 'model',
    )) {
      checkGenericSegmentDepth(slicePath, segmentDirName, collector)
    }
    checkSliceModel(slicePath, collector)
  }
}

export function checkSliceLayerRoots(layerRootPaths, collector) {
  for (const layerRootPath of layerRootPaths) {
    checkSliceLayerRoot(layerRootPath, collector)
  }
}
