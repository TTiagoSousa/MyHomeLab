import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import * as Icon from '../../../Imports/icons';

interface App_Modal_Props {
  onClose: () => void;
  children: ReactNode;
}

const App_Modal = ({ onClose, children }: App_Modal_Props) => {
  const { t } = useTranslation('addons');

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, []);

  return (
    <div className='Apps_modal_overlay' onClick={onClose}>
      <div className='Apps_modal' onClick={(e) => e.stopPropagation()}>
        <button type='button' className='Apps_modal_close' onClick={onClose} aria-label={t('apps.appSettings.close')} title={t('apps.appSettings.close')}>
          <Icon.Close />
        </button>
        {children}
      </div>
    </div>
  );
};

export default App_Modal;
