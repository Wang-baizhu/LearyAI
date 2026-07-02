// 该文件负责前端单元测试的 Vitest 配置。
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

const resolveWritableTempDir = () => {
  const envKeys = ['TMPDIR', 'TMP', 'TEMP'] as const;
  const existingTempDir = envKeys
    .map((key) => process.env[key])
    .find((value): value is string => Boolean(value && fs.existsSync(value)));

  const tempDir = existingTempDir ?? '/tmp/learyai-vitest';
  fs.mkdirSync(tempDir, { recursive: true });
  envKeys.forEach((key) => {
    process.env[key] = tempDir;
  });
};

resolveWritableTempDir();

export default defineConfig({
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: [
      { find: /^react$/, replacement: path.resolve(__dirname, 'node_modules/react/index.js') },
      { find: /^react-dom$/, replacement: path.resolve(__dirname, 'node_modules/react-dom/index.js') },
      { find: '@leary/text-editable', replacement: path.resolve(__dirname, 'packages/infra/text-editable/index.ts') },
      { find: '@leary/ui', replacement: path.resolve(__dirname, 'packages/ui/index.ts') },
      { find: '@leary/template-plugin-sdk-core', replacement: path.resolve(__dirname, 'packages/template/plugin-sdk-core/index.ts') },
      { find: '@leary/template-plugin-sdk-host', replacement: path.resolve(__dirname, 'packages/template/plugin-sdk-host/index.ts') },
      { find: '@leary/template-plugin-sdk-react', replacement: path.resolve(__dirname, 'packages/template/plugin-sdk-react/index.ts') },
      { find: '@', replacement: path.resolve(__dirname, 'src') },
      { find: '@templates', replacement: path.resolve(__dirname, 'src/modules/template') },
    ],
  },
  test: {
    environment: 'node',
    globals: true,
    include: [
      'src/modules/**/*.test.ts',
      'src/modules/**/*.test.tsx',
      'src/shared/**/*.test.ts',
      'src/shared/**/*.test.tsx',
      'packages/template/**/*.test.ts',
      'packages/template/**/*.test.tsx',
      'packages/common/**/*.test.mjs',
    ],
    passWithNoTests: false,
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
  },
});
