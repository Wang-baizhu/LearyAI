// utils 负责提供 tour-guide 包内的轻量 className 组合工具。
export const cn = (...inputs: Array<string | false | null | undefined>) =>
  inputs.filter(Boolean).join(' ');
