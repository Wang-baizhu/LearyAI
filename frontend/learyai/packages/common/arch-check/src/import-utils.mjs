// 该文件负责处理架构校验中的导入解析与层名提示逻辑。
import fs from 'node:fs'
import path from 'node:path'

import { IMPORT_SPECIFIER_REGEX } from './constants.mjs'

function levenshteinDistance(a, b) {
  const rows = a.length + 1
  const cols = b.length + 1
  const dp = Array.from({ length: rows }, () => Array(cols).fill(0))

  for (let i = 0; i < rows; i += 1) dp[i][0] = i
  for (let j = 0; j < cols; j += 1) dp[0][j] = j

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      )
    }
  }

  return dp[a.length][b.length]
}

export function getClosestLayerName(name, knownLayerNames) {
  let best = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (const candidate of knownLayerNames) {
    const distance = levenshteinDistance(name, candidate)
    if (distance < bestDistance) {
      bestDistance = distance
      best = candidate
    }
  }

  if (best !== null && bestDistance <= 2) {
    return { name: best, distance: bestDistance }
  }

  return null
}

export function collectImportSpecifiers(filePath) {
  const source = fs.readFileSync(filePath, 'utf8')
  const specifiers = []

  for (const match of source.matchAll(IMPORT_SPECIFIER_REGEX)) {
    const specifier = match[1] ?? match[2]
    if (specifier) {
      specifiers.push(specifier)
    }
  }

  return specifiers
}

export function resolveImportTarget(filePath, specifier, runtime) {
  for (const alias of runtime.importResolver.aliases) {
    if (!specifier.startsWith(alias.prefix)) {
      continue
    }

    return path.normalize(path.join(alias.targetPath, specifier.slice(alias.prefix.length)))
  }

  if (specifier.startsWith('.')) {
    return path.normalize(path.resolve(path.dirname(filePath), specifier))
  }

  return null
}
