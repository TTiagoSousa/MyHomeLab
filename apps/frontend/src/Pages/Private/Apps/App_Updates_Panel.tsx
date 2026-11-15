import { useState, type ReactNode } from 'react';
import * as Icon from '../../../Imports/icons';

interface App_Updates_Panel_Props {
  id?: string;
  icon?: ReactNode;
  title: string;
  summary: string;
  count?: number;
  countLabel?: string;
  collapsible?: boolean;
  action?: ReactNode;
  children?: ReactNode;
}

const App_Updates_Panel = ({ id = 'app-updates', icon, title, summary, count, countLabel, collapsible = true, action, children }: App_Updates_Panel_Props) => {
  const [open, setOpen] = useState(!collapsible);

  const heading = (
    <>
      {icon ?? <Icon.Refresh />}
      <span className='Apps_updates_text'>
        <span className='Apps_updates_title'>{title}</span>
        <span className='Apps_updates_summary'>{summary}</span>
      </span>
      {countLabel && <span className={`Apps_updates_count${count ? ' has' : ''}`}>{countLabel}</span>}
    </>
  );

  return (
    <section id={id} className={`Apps_section Apps_updates${open ? ' open' : ''}`}>
      {collapsible ? (
        <button type='button' className='Apps_updates_head' onClick={() => setOpen(!open)} aria-expanded={open}>
          {heading}
          <span className='Apps_updates_chevron'>
            <Icon.Chevron />
          </span>
        </button>
      ) : (
        <div className='Apps_updates_head static'>
          {heading}
          {action}
        </div>
      )}

      {open && children && <div className='Apps_updates_body'>{children}</div>}
    </section>
  );
};

export default App_Updates_Panel;
