import js from '@eslint/js'
import globals from 'globals'
// eslint-disable-next-line no-restricted-syntax -- eslint-plugin-import 在 ts-node CJS 运行链路下需使用 namespace 形式
import * as importPlugin from 'eslint-plugin-import'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { globalIgnores } from 'eslint/config'
import { createBaseRules } from '../rules/base'
import { createArchitectureConfigs } from '../rules/architecture'

export function createWebPreset({ projectRoot }) {
  return [
    globalIgnores(['dist', 'coverage', '.gradle', 'android/**/build']),
    {
      files: ['**/*.{ts,tsx}'],
      extends: [
        js.configs.recommended,
        tseslint.configs.recommended,
        reactHooks.configs.flat.recommended,
        reactRefresh.configs.vite,
      ],
      languageOptions: {
        ecmaVersion: 2020,
        globals: globals.browser,
      },
      settings: {
        'import/resolver': {
          typescript: true,
        },
      },
      plugins: {
        import: importPlugin,
      },
      rules: createBaseRules(),
    },
    ...createArchitectureConfigs({ projectRoot }),
    {
      files: ['**/*.test.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ]
}
