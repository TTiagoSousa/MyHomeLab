import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Tplink_Router_Confirm_Props {
  label: string;
  confirmLabel: string;
  question?: string;
  onConfirm: () => void | Promise<unknown>;
  busy?: boolean;
  disabled?: boolean;
  danger?: boolean;
  quiet?: boolean;
}

const Tplink_Router_Confirm = ({ label, confirmLabel, question, onConfirm, busy, disabled, danger, quiet }: Tplink_Router_Confirm_Props) => {
  const { t } = useTranslation('addons');
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type='button' className={danger && !quiet ? 'danger' : ''} onClick={() => setConfirming(true)} disabled={disabled || busy}>
        {label}
      </button>
    );
  }

  return (
    <span className='Tplink_Router_Confirm'>
      {question && <span className='Tplink_Router_Confirm_Question'>{question}</span>}
      <button type='button' onClick={() => setConfirming(false)} disabled={busy}>
        {t('apps.cancel')}
      </button>
      <button
        type='button'
        className={danger ? 'danger' : 'primary'}
        onClick={async () => {
          await onConfirm();
          setConfirming(false);
        }}
        disabled={busy}
      >
        {busy ? t('apps.tplinkRouter.working') : confirmLabel}
      </button>
    </span>
  );
};

export default Tplink_Router_Confirm;
