// validators 提供基础输入校验规则，供 feature 与 shared UI 复用。
export const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value);

export const isValidPassword = (value: string) => {
  const lengthRule = value.length >= 8;
  const complexityRule = /[0-9]/.test(value) || /[^A-Za-z0-9]/.test(value);
  return lengthRule && complexityRule;
};
