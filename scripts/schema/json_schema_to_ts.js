#!/usr/bin/env node
// 该文件职责：把 JSON Schema 转成前端可消费的 TypeScript 类型定义。

const fs = require('fs');
const path = require('path');

const [, , inputFile, outputFile, banner, rootTypeName] = process.argv;
if (!inputFile || !outputFile || !banner || !rootTypeName) {
  throw new Error('usage: json_schema_to_ts.js <input> <output> <banner> <rootTypeName>');
}

const schema = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
const defs = schema.$defs ?? {};

const refName = (ref) => ref.replace(/^#\/\$defs\//, '');
const literal = (value) => JSON.stringify(value);

const renderInlineObject = (node) => {
  const properties = node.properties ?? {};
  const required = new Set(node.required ?? []);
  const lines = ['{'];
  Object.entries(properties).forEach(([key, value]) => {
    lines.push(`  ${JSON.stringify(key)}${required.has(key) ? '' : '?'}: ${renderType(value)};`);
  });
  if (node.additionalProperties && typeof node.additionalProperties === 'object') {
    lines.push(`  [key: string]: ${renderType(node.additionalProperties)};`);
  } else if (node.additionalProperties === true) {
    lines.push('  [key: string]: unknown;');
  }
  lines.push('}');
  return lines.join('\n');
};

const isEmptyObjectDef = (node) => {
  if (!node || node.type !== 'object') return false;
  const hasProperties = Boolean(node.properties && Object.keys(node.properties).length > 0);
  const hasAdditionalProperties = node.additionalProperties !== undefined;
  return !hasProperties && !hasAdditionalProperties;
};

const renderType = (node) => {
  if (!node) return 'unknown';
  if (node.$ref) return refName(node.$ref);
  if (node.const !== undefined) return literal(node.const);
  if (Array.isArray(node.enum)) return node.enum.map(literal).join(' | ');
  if (Array.isArray(node.anyOf)) return node.anyOf.map(renderType).join(' | ');
  if (Array.isArray(node.oneOf)) return node.oneOf.map(renderType).join(' | ');
  if (Array.isArray(node.allOf)) return node.allOf.map(renderType).join(' & ');
  if (Array.isArray(node.type)) return node.type.map((item) => renderType({ ...node, type: item })).join(' | ');
  if (node.type === 'array') return `${renderType(node.items)}[]`;
  if (node.type === 'object') {
    if (node.properties || node.additionalProperties) {
      return renderInlineObject(node);
    }
    return 'Record<string, unknown>';
  }
  switch (node.type) {
    case 'string':
      return 'string';
    case 'integer':
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'null':
      return 'null';
    default:
      return 'unknown';
  }
};

const lines = [banner, ''];

Object.entries(defs).forEach(([name, def]) => {
  if (isEmptyObjectDef(def)) {
    lines.push('export type ' + name + ' = Record<string, never>;');
    lines.push('');
    return;
  }
  if (def.type === 'object' && (def.properties || def.additionalProperties)) {
    lines.push(`export interface ${name} ${renderInlineObject(def)}`);
  } else {
    lines.push(`export type ${name} = ${renderType(def)};`);
  }
  lines.push('');
});

const root = { ...schema };
delete root.$defs;

lines.push(`export type ${rootTypeName} = ${renderType(root)};`);
lines.push('');

fs.writeFileSync(outputFile, `${lines.join('\n').trim()}\n`, 'utf8');
console.log(`generated ${path.relative(process.cwd(), outputFile)}`);
