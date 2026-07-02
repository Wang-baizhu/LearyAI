export function createImportRules() {
  return {
    'import/no-cycle': [
      'error',
      {
        ignoreExternal: true,
        maxDepth: 20,
      },
    ],
    'no-restricted-syntax': [
      'warn',
      {
        selector: 'ImportNamespaceSpecifier',
        message: '请避免使用 import * as，优先显式导入所需成员',
      },
      {
        selector: 'ExportAllDeclaration',
        message: '请避免使用 export *，优先显式导出所需成员',
      },
      {
        selector: 'ImportDeclaration[source.value=/^(?:\\.\\.\\/){5,}/]',
        message: '请避免超过 4 层的相对路径导入，改用别名或公共出口',
      },
      {
        selector: "ImportExpression[source.type='Literal'][source.value=/^(?:\\.\\.\\/){5,}/]",
        message: '请避免超过 4 层的相对路径导入，改用别名或公共出口',
      },
      {
        selector: 'ImportDeclaration[source.value=/^@leary\\/[^/]+\\/.+/]',
        message: '请通过包公开出口导入，不要深层穿透 @leary/* 包内部路径',
      },
      {
        selector: 'ExportNamedDeclaration[source.value=/^@leary\\/[^/]+\\/.+/]',
        message: '请通过包公开出口导出，不要深层穿透 @leary/* 包内部路径',
      },
      {
        selector: 'ExportAllDeclaration[source.value=/^@leary\\/[^/]+\\/.+/]',
        message: '请通过包公开出口导出，不要深层穿透 @leary/* 包内部路径',
      },
    ],
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            regex: '^@/modules/[^/]+/.+',
            message: '跨 module 访问请通过 modules/<module>/index.ts 公开出口，不要深层穿透',
          },
        ],
      },
    ],
  }
}
