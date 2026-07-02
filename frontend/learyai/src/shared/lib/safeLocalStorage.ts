// safeLocalStorage 负责提供带异常保护的 localStorage 读写与删除能力。
export const safeLocalStorageGet = (key: string): string | null => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const safeLocalStorageSet = (key: string, value: string): boolean => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

export const safeLocalStorageRemove = (key: string): boolean => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return false;
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
};
