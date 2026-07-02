import fs from 'node:fs'
import path from 'node:path'

const MODULE_LAYER_DIRS = new Set(['pages', 'widgets', 'features', 'entities', 'shared'])
const SLICE_INTERNAL_DIRS = new Set([
  'ui',
  'model',
  'api',
  'lib',
  'config',
  'types',
  'hooks',
  'store',
  'router',
  'permission',
  'connect',
  'handlers',
  'mock',
  'app',
])

function isCodeFile(name: string) {
  return /\.(ts|tsx)$/.test(name) && !/^index\.tsx?$/.test(name)
}

function hasCodeDeep(dir: string) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isFile() && isCodeFile(entry.name)) {
      return true
    }

    if (entry.isDirectory() && hasCodeDeep(fullPath)) {
      return true
    }
  }

  return false
}

function escapeRegex(value: string) {
  return value.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')
}

function collectSliceRootFileSpecs(modulesRoot: string) {
  const sliceDirs = new Set<string>()

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue
      }

      const fullPath = path.join(dir, entry.name)
      const relativeParts = path.relative(modulesRoot, fullPath).split(path.sep)
      const layerIndex = relativeParts.findIndex((part) => MODULE_LAYER_DIRS.has(part))

      if (layerIndex !== -1) {
        const sliceParts = relativeParts.slice(layerIndex + 1)
        const isSlice =
          sliceParts.length >= 1 &&
          (sliceParts.length === 1 || !SLICE_INTERNAL_DIRS.has(sliceParts.at(-1)))

        if (isSlice && hasCodeDeep(fullPath)) {
          sliceDirs.add(fullPath)
        }
      }

      walk(fullPath)
    }
  }

  walk(modulesRoot)

  const rootFileSpecs: string[] = []
  for (const dir of sliceDirs) {
    const relativeParts = path.relative(modulesRoot, dir).split(path.sep)
    const moduleRelativeDir = relativeParts.slice(1).join('/')

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !isCodeFile(entry.name)) {
        continue
      }

      const fileBaseName = entry.name.replace(/\.(ts|tsx)$/, '')
      rootFileSpecs.push(`${moduleRelativeDir}/${fileBaseName}`)
    }
  }

  return [...new Set(rootFileSpecs)].sort((a, b) => b.length - a.length || a.localeCompare(b))
}

export function createSliceRegexMetadata(projectRoot: string) {
  const modulesRoot = path.resolve(projectRoot, 'src/modules')
  if (!fs.existsSync(modulesRoot) || !fs.statSync(modulesRoot).isDirectory()) {
    return {
      relativeSliceRootFileRegex: '^$',
      relativeSliceInternalRegex:
        '^(?:\\.\\./)+(?:pages|widgets|features|entities|shared)(?:/[^/]+)+/(?:ui|model|api|lib|config|types|hooks|store|router|permission|connect|handlers|mock)(?:/|$)',
    }
  }

  const rootFileSpecs = collectSliceRootFileSpecs(modulesRoot)
  const relativeSliceRootFileRegex =
    rootFileSpecs.length > 0
      ? `^(?:\\.\\./)+(?:${rootFileSpecs.map(escapeRegex).join('|')})$`
      : '^$'
  const relativeSliceInternalRegex =
    '^(?:\\.\\./)+(?:pages|widgets|features|entities|shared)(?:/[^/]+)+/(?:ui|model|api|lib|config|types|hooks|store|router|permission|connect|handlers|mock)(?:/|$)'

  return {
    relativeSliceRootFileRegex,
    relativeSliceInternalRegex,
  }
}
