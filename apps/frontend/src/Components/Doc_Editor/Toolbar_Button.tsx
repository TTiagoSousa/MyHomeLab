import type { ReactNode } from 'react';

interface Toolbar_Button_Props {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  wide?: boolean;
  children: ReactNode;
}

const Toolbar_Button = ({ label, onClick, active, disabled, wide, children }: Toolbar_Button_Props) => (
  <button
    type='button'
    className={`Toolbar_Button${active ? ' active' : ''}${wide ? ' wide' : ''}`}
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    disabled={disabled}
    title={label}
    aria-label={label}
    aria-pressed={active}
  >
    {children}
  </button>
);

export default Toolbar_Button;
