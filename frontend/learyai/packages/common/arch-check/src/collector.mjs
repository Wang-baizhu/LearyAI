// 该文件负责收集架构校验过程中的错误与警告信息。
import path from 'node:path'

export function createCollector() {
  const diagnostics = []
  const warnings = []

  function formatMessage(message, filePath) {
    return `${message} (${path.relative(process.cwd(), filePath)})`
  }

  return {
    diagnostics,
    warnings,
    addDiagnostic(message, filePath) {
      diagnostics.push(formatMessage(message, filePath))
    },
    addWarning(message, filePath) {
      warnings.push(formatMessage(message, filePath))
    },
  }
}
