import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { PROFILE_NAMES, getArchitectureProfile, listArchitectureProfileNames, runArchitectureCheck } from '../index.mjs'

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = path.join(TEST_DIR, 'fixtures')

function fixturePath(name) {
  return path.join(FIXTURES_DIR, name)
}

describe('arch-check profiles', () => {
  it('exposes supported profile names', () => {
    expect(listArchitectureProfileNames()).toEqual([PROFILE_NAMES.LEARY_MODULE, PROFILE_NAMES.GENERIC_FSD])
  })

  it('throws for unsupported profile names', () => {
    expect(() => getArchitectureProfile('unknown-profile')).toThrow(/Unsupported architecture profile/)
  })
})

describe('runArchitectureCheck', () => {
  it('passes valid generic fsd fixtures', () => {
    const result = runArchitectureCheck(PROFILE_NAMES.GENERIC_FSD, { cwd: fixturePath('generic-fsd-valid') })

    expect(result.profile).toBe(PROFILE_NAMES.GENERIC_FSD)
    expect(result.diagnostics).toEqual([])
    expect(result.warnings).toEqual([])
  })

  it('reports missing slice index in invalid generic fsd fixtures', () => {
    const result = runArchitectureCheck(PROFILE_NAMES.GENERIC_FSD, { cwd: fixturePath('generic-fsd-invalid') })

    expect(result.diagnostics).toHaveLength(1)
    expect(result.diagnostics[0]).toContain('缺少公开出口')
  })

  it('passes valid leary module fixtures', () => {
    const result = runArchitectureCheck(PROFILE_NAMES.LEARY_MODULE, { cwd: fixturePath('leary-module-valid') })

    expect(result.profile).toBe(PROFILE_NAMES.LEARY_MODULE)
    expect(result.diagnostics).toEqual([])
    expect(result.warnings).toEqual([])
  })

  it('reports cross-module deep imports in invalid leary module fixtures', () => {
    const result = runArchitectureCheck(PROFILE_NAMES.LEARY_MODULE, { cwd: fixturePath('leary-module-invalid-cross') })

    expect(result.diagnostics).toHaveLength(1)
    expect(result.diagnostics[0]).toContain('跨 module 依赖只能引用目标 module 的公开出口')
  })

  it('reports redundant same-name nesting under module shared directories', () => {
    const result = runArchitectureCheck(PROFILE_NAMES.LEARY_MODULE, {
      cwd: fixturePath('leary-module-invalid-shared-nesting'),
    })

    expect(result.diagnostics).toHaveLength(1)
    expect(result.diagnostics[0]).toContain('shared/config 禁止出现同名目录重复嵌套')
  })
})
