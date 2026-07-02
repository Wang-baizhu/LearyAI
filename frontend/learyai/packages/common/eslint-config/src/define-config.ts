import { defineConfig } from 'eslint/config'
import { createWebPreset } from './presets/web'

export function defineLearyEslintConfig({ projectRoot = process.cwd(), preset = 'web' } = {}) {
  if (preset !== 'web') {
    throw new Error(`Unsupported preset "${preset}". Currently only "web" is supported.`)
  }

  // 配置入口需要把 preset 产物整体传给 ESLint，这里只做边界断言。
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return defineConfig(...(createWebPreset({ projectRoot }) as any))
}
