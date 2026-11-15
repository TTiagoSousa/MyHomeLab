import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import './Assistant_Settings_Menu.scss';
import { ASSISTANT_SETTINGS_SECTIONS, assistantSettingsPath } from '../../../Constants/assistantSettings';
import * as Icon from '../../../Imports/icons';

const Assistant_Settings_Menu = () => {
  const { t } = useTranslation('assistant');
  const navigate = useNavigate();
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
    <div className='Assistant_Settings_Menu' ref={menuRef}>
      <button
        className={`Assistant_New${open ? ' active' : ''}`}
        onClick={() => setOpen(!open)}
        type='button'
        aria-expanded={open}
        aria-haspopup='menu'
      >
        <Icon.Settings />
        <span>{t('header.settings')}</span>
      </button>

      {open && (
        <div className='Assistant_Settings_Menu_panel' role='menu'>
          <span className='Assistant_Settings_Menu_title'>{t('settings.title')}</span>
          {ASSISTANT_SETTINGS_SECTIONS.map(({ id, icon: SectionIcon }) => (
            <button key={id} type='button' role='menuitem' onClick={() => navigate(assistantSettingsPath(id))}>
              <SectionIcon />
              <span className='Assistant_Settings_Menu_text'>
                <span className='Assistant_Settings_Menu_name'>{t(`settings.sections.${id}`)}</span>
                <span className='Assistant_Settings_Menu_hint'>{t(`settings.hints.${id}`)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Assistant_Settings_Menu;
