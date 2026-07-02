import { createReactRules } from './react'
import { createTypeScriptRules } from './typescript'
import { createSafetyRules } from './safety'
import { createImportRules } from './imports'

export function createBaseRules() {
  return {
    ...createReactRules(),
    ...createTypeScriptRules(),
    ...createSafetyRules(),
    ...createImportRules(),
  }
}
