import { useState } from 'react';

const STORAGE_KEY = 'docs.tree.open';

const readStored = (): Record<string, boolean> => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, boolean>;
  } catch {
    return {};
  }
};

export const useTreeState = () => {
  const [open, setOpen] = useState<Record<string, boolean>>(readStored);

  const isOpen = (key: string, openByDefault = true) => open[key] ?? openByDefault;

  const toggle = (key: string, openByDefault = true) => {
    setOpen((current) => {
      const next = { ...current, [key]: !(current[key] ?? openByDefault) };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        return next;
      }
      return next;
    });
  };

  return { isOpen, toggle };
};
