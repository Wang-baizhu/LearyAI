/** 责任：维护白板可持久化快照中的瞬态字段剥离逻辑。 */
export const stripTransientSelection = <T extends { selected?: boolean }>(item: T) => {
  const nextItem = { ...item };
  delete nextItem.selected;
  return nextItem;
};
