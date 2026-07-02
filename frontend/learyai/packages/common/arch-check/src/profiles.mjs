// 该文件负责定义架构校验脚本的 profile 装配，解耦通用 FSD 规则与项目专属布局规则。
import path from 'node:path'

export const PROFILE_NAMES = {
  LEARY_MODULE: 'leary-module',
  GENERIC_FSD: 'generic-fsd',
}

function createImportResolverConfig(srcRoot, extraAliases = []) {
  return {
    srcRoot,
    aliases: [{ prefix: '@/', targetPath: srcRoot }, ...extraAliases],
  }
}

function resolveSrcRoot(cwd) {
  return path.resolve(cwd, 'src')
}

export function listArchitectureProfileNames() {
  return Object.values(PROFILE_NAMES)
}

export function createLearyModuleProfile({ cwd = process.cwd() } = {}) {
  const srcRoot = resolveSrcRoot(cwd)
  const modulesRoot = path.join(srcRoot, 'modules')

  return {
    name: PROFILE_NAMES.LEARY_MODULE,
    knownLayerNames: ['app', 'pages', 'widgets', 'features', 'entities', 'adapter', 'shared', 'processes'],
    importResolver: createImportResolverConfig(srcRoot, [
      { prefix: '@templates/', targetPath: path.join(modulesRoot, 'template') },
    ]),
    appRules: {
      deprecatedLayerNames: ['processes'],
      forbidAppUi: true,
      appRoot: path.join(srcRoot, 'app'),
    },
    sharedRoots: [
      {
        path: path.join(srcRoot, 'shared'),
        invalidDependencyRoots: [modulesRoot],
        invalidDependencyMessage: '全局 shared 禁止依赖 modules 业务层代码',
      },
    ],
    sliceLayerRoots: [],
    moduleLayout: {
      modulesRoot,
      moduleLayerDirs: ['pages', 'widgets', 'features', 'entities', 'adapter', 'shared'],
      moduleExtraDirs: ['templates'],
      sliceLayerDirs: new Set(['pages', 'widgets', 'features', 'entities']),
      sharedInvalidDependencyLayerNames: ['pages', 'widgets', 'features', 'entities', 'adapter'],
    },
  }
}

export function createGenericFsdProfile({ cwd = process.cwd() } = {}) {
  const srcRoot = resolveSrcRoot(cwd)

  return {
    name: PROFILE_NAMES.GENERIC_FSD,
    knownLayerNames: ['app', 'pages', 'widgets', 'features', 'entities', 'shared', 'processes'],
    importResolver: createImportResolverConfig(srcRoot),
    appRules: {
      deprecatedLayerNames: ['processes'],
      forbidAppUi: false,
      appRoot: path.join(srcRoot, 'app'),
    },
    sharedRoots: [{ path: path.join(srcRoot, 'shared'), invalidDependencyRoots: [], invalidDependencyMessage: '' }],
    sliceLayerRoots: ['pages', 'widgets', 'features', 'entities']
      .map((layerName) => path.join(srcRoot, layerName)),
    moduleLayout: null,
  }
}

export function getArchitectureProfile(profileName = PROFILE_NAMES.LEARY_MODULE, options = {}) {
  if (profileName === PROFILE_NAMES.GENERIC_FSD) {
    return createGenericFsdProfile(options)
  }

  if (profileName === PROFILE_NAMES.LEARY_MODULE || profileName === undefined) {
    return createLearyModuleProfile(options)
  }

  throw new Error(
    `Unsupported architecture profile "${profileName}". Available profiles: ${listArchitectureProfileNames().join(', ')}`,
  )
}
