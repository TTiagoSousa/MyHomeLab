import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

type NavigationType = 'Sidebar_Home' | 'Top_Nav_Navigation' | 'Mobile_Menu';

interface NavigationContextType {
  typeOfNavigation: NavigationType;
  setTypeOfNavigation: (type: NavigationType) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [typeOfNavigation, setTypeOfNavigationState] = useState<NavigationType>(() => {
    const saved = localStorage.getItem('sidebarPosition');
    return (saved as NavigationType) || 'Sidebar_Home';
  });

  useEffect(() => {
    localStorage.setItem('sidebarPosition', typeOfNavigation);
  }, [typeOfNavigation]);

  const setTypeOfNavigation = (type: NavigationType) => {
    setTypeOfNavigationState(type);
  };

  return (
    <NavigationContext.Provider value={{ typeOfNavigation, setTypeOfNavigation }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavs() {
  const context = useContext(NavigationContext);
  
  if (context === undefined) {
    throw new Error('useNavs must be used within a NavigationProvider');
  }
  
  return context;
}