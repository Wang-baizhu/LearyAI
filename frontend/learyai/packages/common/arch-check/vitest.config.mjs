// 该文件负责 @leary/arch-check 包级测试的 Vitest 配置，确保 fixtures 与 CLI 测试可独立运行。
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

const PACKAGE_DIR = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: PACKAGE_DIR,
  test: {
    environment: 'node',
    include: ['test/**/*.test.mjs'],
    passWithNoTests: false,
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
  },
})
