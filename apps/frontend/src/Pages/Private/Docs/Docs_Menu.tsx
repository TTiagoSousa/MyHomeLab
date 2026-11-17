import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface Docs_Menu_Item {
  id: string;
  label: string;
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

interface Docs_Menu_Props {
  label: string;
  trigger: ReactNode;
  items: Docs_Menu_Item[];
  className?: string;
}

const Docs_Menu = ({ label, trigger, items, className = '' }: Docs_Menu_Props) => {
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
    <div className={`Docs_Menu ${className}`} ref={menuRef}>
      <button
        type='button'
        className={`Docs_Menu_Trigger${open ? ' active' : ''}`}
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-haspopup='menu'
        onClick={(event) => {
          event.stopPropagation();
          setOpen(!open);
        }}
      >
        {trigger}
      </button>
      {open && (
        <div className='Docs_Menu_Panel' role='menu'>
          {items.map((item) => (
            <button
              key={item.id}
              type='button'
              role='menuitem'
              className={item.danger ? 'danger' : ''}
              disabled={item.disabled}
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
                item.onSelect();
              }}
            >
              <span className='Docs_Menu_Label'>{item.label}</span>
              {item.hint && <span className='Docs_Menu_Hint'>{item.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Docs_Menu;
