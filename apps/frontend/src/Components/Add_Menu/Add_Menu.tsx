import { useEffect, useRef, useState } from 'react';
import './Add_Menu.scss';
import * as Icon from '../../Imports/icons';

export interface Add_Menu_Option {
  id: string;
  name: string;
  subtitle?: string;
  available: boolean;
  tag?: string;
}

interface Add_Menu_Props {
  label: string;
  title: string;
  soonLabel: string;
  options: Add_Menu_Option[];
  onSelect: (id: string) => void;
}

const Add_Menu = ({ label, title, soonLabel, options, onSelect }: Add_Menu_Props) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const handleSelect = (option: Add_Menu_Option) => {
    if (!option.available) return;
    setOpen(false);
    onSelect(option.id);
  };

  return (
    <div className='Add_Menu' ref={menuRef}>
      <button type='button' className='Add_Menu_button' onClick={() => setOpen(!open)}>
        <Icon.Plus />
        <span>{label}</span>
      </button>

      {open && (
        <div className='Add_Menu_list'>
          <span className='Add_Menu_title'>{title}</span>

          {options.map((option) => (
            <button
              key={option.id}
              type='button'
              className='Add_Menu_item'
              disabled={!option.available}
              onClick={() => handleSelect(option)}
            >
              <span className='Add_Menu_mark'>{option.name.charAt(0)}</span>
              <span className='Add_Menu_text'>
                <span className='Add_Menu_name'>{option.name}</span>
                {option.subtitle && <span className='Add_Menu_subtitle'>{option.subtitle}</span>}
              </span>
              {!option.available && <span className='Add_Menu_tag'>{soonLabel}</span>}
              {option.available && option.tag && <span className='Add_Menu_tag on'>{option.tag}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Add_Menu;
