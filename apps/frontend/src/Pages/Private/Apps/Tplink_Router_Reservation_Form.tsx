import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../Components/Inputs/Global_Input/Global_Input';

export interface Reservation_Draft {
  mac: string;
  ip: string;
  name: string;
}

interface Tplink_Router_Reservation_Form_Props {
  initial: Reservation_Draft;
  busy: boolean;
  onCancel: () => void;
  onSave: (draft: Reservation_Draft) => void;
}

const Tplink_Router_Reservation_Form = ({ initial, busy, onCancel, onSave }: Tplink_Router_Reservation_Form_Props) => {
  const { t } = useTranslation('addons');
  const [draft, setDraft] = useState(initial);

  const canSave = draft.mac.trim().length > 0 && draft.ip.trim().length > 0;

  return (
    <div className='Tplink_Router_Form'>
      <span className='Tplink_Router_Box_Title'>{t('apps.tplinkRouter.dhcp.formTitle')}</span>
      <div className='Apps_inline_fields'>
        <div className='Apps_inline_field'>
          <label htmlFor='tplink-reservation-name'>{t('apps.tplinkRouter.table.name')}</label>
          <Global_Input id='tplink-reservation-name' value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={64} />
        </div>
        <div className='Apps_inline_field'>
          <label htmlFor='tplink-reservation-mac'>{t('apps.tplinkRouter.table.mac')}</label>
          <Global_Input
            id='tplink-reservation-mac'
            value={draft.mac}
            onChange={(e) => setDraft({ ...draft, mac: e.target.value })}
            placeholder={t('apps.tplinkRouter.dhcp.macPlaceholder')}
            maxLength={32}
          />
        </div>
        <div className='Apps_inline_field'>
          <label htmlFor='tplink-reservation-ip'>{t('apps.tplinkRouter.table.ip')}</label>
          <Global_Input
            id='tplink-reservation-ip'
            value={draft.ip}
            onChange={(e) => setDraft({ ...draft, ip: e.target.value })}
            placeholder={t('apps.tplinkRouter.dhcp.ipPlaceholder')}
            maxLength={15}
          />
        </div>
      </div>
      <div className='Apps_footer'>
        <button type='button' onClick={onCancel} disabled={busy}>
          {t('apps.cancel')}
        </button>
        <button
          type='button'
          className='primary'
          onClick={() => onSave({ mac: draft.mac.trim(), ip: draft.ip.trim(), name: draft.name.trim() })}
          disabled={busy || !canSave}
        >
          {busy ? t('apps.tplinkRouter.working') : t('apps.tplinkRouter.dhcp.save')}
        </button>
      </div>
    </div>
  );
};

export default Tplink_Router_Reservation_Form;
