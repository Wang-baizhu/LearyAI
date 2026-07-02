import { createSliceRegexMetadata } from '../utils/slice-metadata'

const ARCH_LAYER_MESSAGE = '违反 code-organization.md 的模块分层依赖方向'

const createRestrictedImportsRule = (patterns: Array<{ regex: string; message: string }>) =>
  // 这里只是把 ESLint 规则入参包装成统一结构，最终由 ESLint 自身做校验。
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ['error', { patterns }] as any

export function createArchitectureConfigs({ projectRoot }: { projectRoot: string }) {
  const { relativeSliceRootFileRegex, relativeSliceInternalRegex } = createSliceRegexMetadata(projectRoot)

  return [
    {
      files: ['src/modules/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': createRestrictedImportsRule([
          {
            regex: relativeSliceRootFileRegex,
            message: '跨 slice 访问请通过该 slice 根目录 index.ts 公开出口，不要直接引用 slice 根文件',
          },
          {
            regex: relativeSliceInternalRegex,
            message: '跨 slice 访问请通过该 slice 根目录 index.ts 公开出口，不要穿透 ui/model/api 等内部实现',
          },
        ]),
      },
    },
    {
      files: ['src/shared/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': createRestrictedImportsRule([
          {
            regex: '^@/modules(?:/|$)',
            message: 'shared 不允许依赖 modules',
          },
          {
            regex: '^\\.\\./.*modules(?:/|$)',
            message: 'shared 不允许依赖 modules',
          },
        ]),
      },
    },
    {
      files: ['src/modules/**/widgets/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': createRestrictedImportsRule([
          {
            regex: '(?:^|/)pages/',
            message: `${ARCH_LAYER_MESSAGE}: widgets 不能依赖 pages`,
          },
        ]),
      },
    },
    {
      files: ['src/modules/**/features/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': createRestrictedImportsRule([
          {
            regex: '(?:^|/)pages/',
            message: `${ARCH_LAYER_MESSAGE}: features 不能依赖 pages`,
          },
          {
            regex: '(?:^|/)widgets/',
            message: `${ARCH_LAYER_MESSAGE}: features 不能依赖 widgets`,
          },
        ]),
      },
    },
    {
      files: ['src/modules/**/entities/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': createRestrictedImportsRule([
          {
            regex: '(?:^|/)pages/',
            message: `${ARCH_LAYER_MESSAGE}: entities 不能依赖 pages`,
          },
          {
            regex: '(?:^|/)widgets/',
            message: `${ARCH_LAYER_MESSAGE}: entities 不能依赖 widgets`,
          },
          {
            regex: '(?:^|/)features/',
            message: `${ARCH_LAYER_MESSAGE}: entities 不能依赖 features`,
          },
        ]),
      },
    },
    {
      files: ['src/modules/**/shared/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': createRestrictedImportsRule([
          {
            regex: '(?:^|/)pages/',
            message: `${ARCH_LAYER_MESSAGE}: module shared 不能依赖 pages`,
          },
          {
            regex: '(?:^|/)widgets/',
            message: `${ARCH_LAYER_MESSAGE}: module shared 不能依赖 widgets`,
          },
          {
            regex: '(?:^|/)features/',
            message: `${ARCH_LAYER_MESSAGE}: module shared 不能依赖 features`,
          },
          {
            regex: '(?:^|/)entities/',
            message: `${ARCH_LAYER_MESSAGE}: module shared 不应依赖 entities`,
          },
        ]),
      },
    },
  ]
}
