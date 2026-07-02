import { describe, expect, it } from 'vitest'
import { runCli } from '../cli.mjs'

function createIo() {
  const outputs = {
    info: [],
    warn: [],
    error: [],
    exitCode: null,
  }

  return {
    outputs,
    io: {
      info: (message) => outputs.info.push(message),
      warn: (message) => outputs.warn.push(message),
      error: (message) => outputs.error.push(message),
      exit: (code) => {
        outputs.exitCode = code
      },
    },
  }
}

describe('arch-check cli', () => {
  it('prints help text', () => {
    const { io, outputs } = createIo()

    runCli(['node', 'cli.mjs', '--help'], io)

    expect(outputs.exitCode).toBeNull()
    expect(outputs.info.join('\n')).toContain('Usage: leary-arch-check')
    expect(outputs.info.join('\n')).toContain('Available profiles:')
  })

  it('fails fast for unsupported profiles', () => {
    const { io, outputs } = createIo()

    runCli(['node', 'cli.mjs', '--profile=unknown-profile'], io)

    expect(outputs.exitCode).toBe(2)
    expect(outputs.error.join('\n')).toContain('Unsupported architecture profile')
  })
})
