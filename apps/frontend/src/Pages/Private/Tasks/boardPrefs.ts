const COLLAPSED_PREFIX = 'myhomelab:board-collapsed:';
const HIDE_EMPTY_KEY = 'myhomelab:board-hide-empty';

const readItem = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeItem = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    return;
  }
};

export const loadCollapsed = (projectId: string): string[] => {
  try {
    const parsed = JSON.parse(readItem(`${COLLAPSED_PREFIX}${projectId}`) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
};

export const saveCollapsed = (projectId: string, ids: string[]) => writeItem(`${COLLAPSED_PREFIX}${projectId}`, JSON.stringify(ids));

export const loadHideEmpty = () => readItem(HIDE_EMPTY_KEY) !== '0';

export const saveHideEmpty = (hide: boolean) => writeItem(HIDE_EMPTY_KEY, hide ? '1' : '0');
