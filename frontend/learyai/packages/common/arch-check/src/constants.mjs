// 该文件负责定义架构校验脚本通用的 FSD 规则常量。
export const SLICE_INDEX_FILES = ['index.ts', 'index.tsx']
export const SHARED_ROOT_ALLOWED_FILES = new Set(['index.ts', 'index.tsx', 'types.ts'])
export const CODE_FILE_REGEX = /\.(ts|tsx)$/
export const DOCS_DIR_NAME = 'docs'
export const IMPORT_SPECIFIER_REGEX =
  /\b(?:import|export)\b[\s\S]*?\bfrom\s*['"]([^'"]+)['"]|^\s*import\s*['"]([^'"]+)['"]/gm
export const SLICE_ROOT_DIRS = new Set(['ui', 'model', 'api', 'lib', 'config'])
export const MODEL_SUB_DIRS = new Set(['store', 'hooks', 'actions', 'selectors', 'effects', 'types'])
export const SHARED_TOP_LEVEL_DIRS = new Set([
  'ui',
  'api',
  'hooks',
  'lib',
  'config',
  'types',
  'model',
  'query',
  'contexts',
])
export const MODEL_ROOT_FILE_WARN_THRESHOLD = 2
export const TEST_DIR_NAME = '__tests__'
