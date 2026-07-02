// 职责: 提供 content 组件内部使用的引用页码格式化能力。
export const normalizeReferencePageValue = (page: string) => {
  const safePage = String(page ?? '').trim();
  return safePage.toUpperCase().startsWith('P') ? safePage.slice(1) : safePage;
};
