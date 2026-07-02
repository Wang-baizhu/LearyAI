// 该文件负责提供架构校验需要的文件系统遍历与目录判定工具。
import fs from 'node:fs'
import path from 'node:path'

import { CODE_FILE_REGEX, SLICE_INDEX_FILES, SLICE_ROOT_DIRS } from './constants.mjs'

export function isDirectory(targetPath) {
  try {
    return fs.statSync(targetPath).isDirectory()
  } catch {
    return false
  }
}

export function listDirectories(targetPath) {
  return fs
    .readdirSync(targetPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
}

export function listFiles(targetPath) {
  return fs
    .readdirSync(targetPath, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
}

export function listCodeFilesDeep(targetPath) {
  const codeFiles = []

  for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
    const fullPath = path.join(targetPath, entry.name)
    if (entry.isFile() && CODE_FILE_REGEX.test(entry.name)) {
      codeFiles.push(fullPath)
      continue
    }
    if (entry.isDirectory()) {
      codeFiles.push(...listCodeFilesDeep(fullPath))
    }
  }

  return codeFiles
}

export function hasCodeDeep(targetPath) {
  for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
    const fullPath = path.join(targetPath, entry.name)
    if (entry.isFile() && CODE_FILE_REGEX.test(entry.name)) {
      return true
    }
    if (entry.isDirectory() && hasCodeDeep(fullPath)) {
      return true
    }
  }
  return false
}

export function collectSlicePaths(layerPath) {
  const slicePaths = []

  function walk(candidatePath) {
    const childDirs = listDirectories(candidatePath)
    const directCodeFiles = listFiles(candidatePath).filter((fileName) => CODE_FILE_REGEX.test(fileName))
    const hasLeafSegmentDirs = childDirs.some((dirName) => SLICE_ROOT_DIRS.has(dirName))
    const hasNonIndexDirectCodeFiles = directCodeFiles.some((fileName) => !SLICE_INDEX_FILES.includes(fileName))
    const hasNestedCandidates = childDirs.length > 0

    // 业务父目录：允许多层分组，仅含 index.ts(x) 与子目录，不直接落具体实现。
    const isBusinessParentDir = !hasLeafSegmentDirs && !hasNonIndexDirectCodeFiles && hasNestedCandidates
    if (isBusinessParentDir) {
      for (const childDirName of childDirs) {
        walk(path.join(candidatePath, childDirName))
      }
      return
    }

    if (hasCodeDeep(candidatePath)) {
      slicePaths.push(candidatePath)
    }
  }

  for (const dirName of listDirectories(layerPath)) {
    walk(path.join(layerPath, dirName))
  }

  return slicePaths
}

export function hasNestedDirectoryNamed(targetPath, directoryName) {
  for (const childDirName of listDirectories(targetPath)) {
    const childPath = path.join(targetPath, childDirName)
    if (childDirName === directoryName || hasNestedDirectoryNamed(childPath, directoryName)) {
      return true
    }
  }

  return false
}

export function hasNestedSliceRootDir(targetPath) {
  for (const childDirName of listDirectories(targetPath)) {
    const childPath = path.join(targetPath, childDirName)
    if (SLICE_ROOT_DIRS.has(childDirName) || hasNestedSliceRootDir(childPath)) {
      return true
    }
  }

  return false
}

export function listDirectoriesDeep(targetPath) {
  const directoryPaths = []

  function walk(currentPath) {
    for (const childDirName of listDirectories(currentPath)) {
      const childPath = path.join(currentPath, childDirName)
      directoryPaths.push(childPath)
      walk(childPath)
    }
  }

  walk(targetPath)

  return directoryPaths
}
