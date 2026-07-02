#!/usr/bin/env node
// 该文件负责作为 arch-check workspace 包的 CLI 入口，按 profile 执行规则并输出结果。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { listArchitectureProfileNames } from './src/profiles.mjs'
import { runArchitectureCheck } from './src/run-check.mjs'

function formatHelpText() {
  return [
    'Usage: leary-arch-check [options]',
    '',
    'Options:',
    '  --profile=<name>  Architecture profile to run',
    '  --cwd=<path>      Project root to inspect; defaults to current working directory',
    '  --help            Show this help message',
    '',
    `Available profiles: ${listArchitectureProfileNames().join(', ')}`,
  ].join('\n')
}

function readCliOptions(argv) {
  const cliArgs = argv.slice(2)
  const profileArg = cliArgs.find((arg) => arg.startsWith('--profile='))
  const cwdArg = cliArgs.find((arg) => arg.startsWith('--cwd='))

  return {
    cwd: cwdArg ? path.resolve(cwdArg.slice('--cwd='.length)) : process.cwd(),
    help: cliArgs.includes('--help') || cliArgs.includes('-h'),
    profileName: profileArg ? profileArg.slice('--profile='.length) : process.env.ARCH_CHECK_PROFILE,
  }
}

export function runCli(
  argv = process.argv,
  io = {
    error: (message) => console.error(message),
    exit: (code) => process.exit(code),
    info: (message) => console.log(message),
    warn: (message) => console.warn(message),
  },
) {
  const options = readCliOptions(argv)
  if (options.help) {
    io.info(formatHelpText())
    return
  }

  let result
  try {
    result = runArchitectureCheck(options.profileName, { cwd: options.cwd })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    io.error(`Architecture check failed to start: ${message}`)
    io.exit(2)
    return
  }

  const { diagnostics, warnings, profile } = result

  if (warnings.length > 0) {
    io.warn(`Architecture check warnings (${profile}):`)
    for (const [index, message] of warnings.entries()) {
      io.warn(`${index + 1}. ${message}`)
    }
  }

  if (diagnostics.length > 0) {
    io.error(`Architecture check failed (${profile}):`)
    for (const [index, message] of diagnostics.entries()) {
      io.error(`${index + 1}. ${message}`)
    }
    io.exit(1)
    return
  }

  io.info(`Architecture check passed (${profile}).`)
}

const currentFilePath = fs.realpathSync(fileURLToPath(import.meta.url))
const invokedFilePath = process.argv[1] ? fs.realpathSync(path.resolve(process.argv[1])) : null

if (invokedFilePath === currentFilePath) {
  runCli()
}
