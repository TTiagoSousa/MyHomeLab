import { createContext, useContext, useState, type ReactNode } from 'react';

interface MenuValue {
  open: boolean;
  openMenu: () => void;
  closeMenu: () => void;
}

const MenuContext = createContext<MenuValue | null>(null);

export const MenuProvider = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  return (
    <MenuContext.Provider value={{ open, openMenu: () => setOpen(true), closeMenu: () => setOpen(false) }}>
      {children}
    </MenuContext.Provider>
  );
};

export const useMenu = () => {
  const value = useContext(MenuContext);
  if (!value) throw new Error('useMenu outside MenuProvider');
  return value;
};
