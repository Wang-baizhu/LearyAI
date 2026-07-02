require('ts-node').register({
  transpileOnly: true,
  cwd: __dirname,
  compilerOptions: {
    module: 'CommonJS',
    moduleResolution: 'node',
    esModuleInterop: true,
  },
})

const { defineLearyEslintConfig } = require('./src/define-config.ts')

module.exports = { defineLearyEslintConfig }
