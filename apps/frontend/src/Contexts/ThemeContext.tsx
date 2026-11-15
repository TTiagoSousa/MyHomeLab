import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type ThemeMode = 'dark' | 'light' | 'auto';

interface ThemeContextType {
  mode: ThemeMode;
  handleDarkMode: () => void;
  handleLightMode: () => void;
  handleAutoMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [mode, setMode] = useState<ThemeMode>('dark');

  useEffect(() => {
    const storedMode = localStorage.getItem('mode') as ThemeMode | null;
    if (storedMode) {
      setMode(storedMode);
    }
  }, []);

  useEffect(() => {
    if (mode === 'light') {
      document.body.className = 'Light_Mode';
    } else if (mode === 'dark') {
      document.body.className = 'Dark_Mode';
    } else {
      const currentTime = new Date().getHours();
      if (currentTime >= 20 || currentTime < 7) {
        document.body.className = 'Dark_Mode';
      } else {
        document.body.className = 'Light_Mode';
      }
    }
  }, [mode]);

  const handleDarkMode = () => {
    localStorage.setItem('mode', 'dark');
    setMode('dark');
  };

  const handleLightMode = () => {
    localStorage.setItem('mode', 'light');
    setMode('light');
  };

  const handleAutoMode = () => {
    localStorage.setItem('mode', 'auto');
    setMode('auto');
  };

  return (
    <ThemeContext.Provider
      value={{
        mode,
        handleDarkMode,
        handleLightMode,
        handleAutoMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  
  return context;
}