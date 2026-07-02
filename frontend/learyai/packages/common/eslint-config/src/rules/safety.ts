export function createSafetyRules() {
  return {
    'no-empty': [
      'error',
      {
        allowEmptyCatch: false,
      },
    ],
  }
}
