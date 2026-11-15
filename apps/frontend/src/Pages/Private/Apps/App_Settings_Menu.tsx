import { useEffect, useRef, useState, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import './App_Settings_Menu.scss';
import * as Icon from '../../../Imports/icons';

export interface App_Settings_Item {
  id: string;
  icon: ComponentType;
  name: string;
  hint: string;
  onSelect: () => void;
}

const App_Settings_Menu = ({ items }: { items: App_Settings_Item[] }) => {
  const { t } = useTranslation('addons');
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div className='App_Settings_Menu' ref={menuRef}>
      <button
        type='button'
        className={`App_Settings_Menu_button${open ? ' active' : ''}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup='menu'
      >
        <Icon.Settings />
        <span>{t('apps.appSettings.button')}</span>
      </button>

      {open && (
        <div className='App_Settings_Menu_panel' role='menu'>
          <span className='App_Settings_Menu_title'>{t('apps.appSettings.title')}</span>
          {items.map(({ id, icon: ItemIcon, name, hint, onSelect }) => (
            <button
              key={id}
              type='button'
              role='menuitem'
              onClick={() => {
                setOpen(false);
                onSelect();
              }}
            >
              <ItemIcon />
              <span className='App_Settings_Menu_text'>
                <span className='App_Settings_Menu_name'>{name}</span>
                <span className='App_Settings_Menu_hint'>{hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default App_Settings_Menu;
