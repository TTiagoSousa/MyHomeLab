import { useEffect, useState } from 'react';

export type BodyTheme = 'dark' | 'light';

const readBodyTheme = (): BodyTheme => (document.body.classList.contains('Light_Mode') ? 'light' : 'dark');

export const useBodyTheme = () => {
  const [theme, setTheme] = useState<BodyTheme>(readBodyTheme);

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(readBodyTheme()));
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return theme;
};
