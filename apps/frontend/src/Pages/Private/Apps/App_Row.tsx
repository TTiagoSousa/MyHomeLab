import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface App_Row_Props {
  icon: ReactNode;
  name: string;
  description: string;
  hosting?: string;
  status: string;
  connected: boolean;
  onOpen: () => void;
}

const App_Row = ({ icon, name, description, hosting, status, connected, onOpen }: App_Row_Props) => {
  const { t } = useTranslation('addons');

  return (
    <div className='Apps_app' onClick={onOpen}>
      <div className='Apps_app_icon'>{icon}</div>

      <div className='Apps_app_info'>
        <span className='Apps_app_name'>{name}</span>
        <span className='Apps_app_description'>{description}</span>
      </div>

      {hosting && <span className='Apps_chip Apps_hosting'>{hosting}</span>}
      <span className={`Apps_chip${connected ? ' on' : ''}`}>{status}</span>

      <button
        type='button'
        className='Apps_app_open'
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
      >
        {t('apps.seeMore')}
      </button>
    </div>
  );
};

export default App_Row;
