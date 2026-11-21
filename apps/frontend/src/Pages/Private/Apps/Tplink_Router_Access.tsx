import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TplinkRouterData } from '../../../Hooks/ConnectedAccount/useTplinkRouterStatus';
import type { TplinkRouterActionName, TplinkRouterActionPayload } from '../../../Hooks/ConnectedAccount/useTplinkRouterAction';
import Global_Dropdown from '../../../Components/Inputs/Global_Dropdown/Global_Dropdown';

type Access_Mode = 'blacklist' | 'whitelist';

interface Tplink_Router_Access_Props {
  router: TplinkRouterData;
  running: TplinkRouterActionName | null;
  onAction: (payload: TplinkRouterActionPayload) => Promise<boolean>;
}

const Tplink_Router_Access = ({ router, running, onAction }: Tplink_Router_Access_Props) => {
  const { t } = useTranslation('addons');
  const current = router.accessControl;
  const [enabled, setEnabled] = useState(current?.enabled ?? false);
  const [mode, setMode] = useState<Access_Mode>(current?.mode ?? 'blacklist');

  const changed = Boolean(current) && (enabled !== current?.enabled || mode !== current?.mode);
  const modes = (['blacklist', 'whitelist'] as Access_Mode[]).map((value) => ({ value, label: t(`apps.tplinkRouter.access.modes.${value}`) }));

  const reset = () => {
    setEnabled(current?.enabled ?? false);
    setMode(current?.mode ?? 'blacklist');
  };

  return (
    <div className='Tplink_Router_Panel'>
      <div className='Tplink_Router_Form'>
        <span className='Tplink_Router_Box_Title'>{t('apps.tplinkRouter.access.title')}</span>
        {current ? (
          <>
            <div className='Apps_inline_fields Tplink_Router_Access_Fields'>
              <label className='Apps_checkbox'>
                <input type='checkbox' checked={enabled} onChange={(e) => setEnabled(e.target.checked)} disabled={Boolean(running)} />
                <span>{enabled ? t('apps.tplinkRouter.access.enabled') : t('apps.tplinkRouter.access.disabled')}</span>
              </label>
              <div className='Apps_inline_field Tplink_Router_Access_Mode'>
                <label>{t('apps.tplinkRouter.access.mode')}</label>
                <Global_Dropdown
                  value={mode}
                  options={modes}
                  onChange={(value) => setMode(value as Access_Mode)}
                  searchable={false}
                  disabled={Boolean(running)}
                />
              </div>
            </div>
            <p className='Apps_section_note'>{t(`apps.tplinkRouter.access.modeHints.${mode}`)}</p>
            <div className='Apps_footer'>
              <button type='button' onClick={reset} disabled={!changed || Boolean(running)}>
                {t('apps.cancel')}
              </button>
              <button
                type='button'
                className='primary'
                onClick={() => void onAction({ action: 'accessControl', enabled, mode })}
                disabled={!changed || Boolean(running)}
              >
                {running === 'accessControl' ? t('apps.tplinkRouter.working') : t('apps.tplinkRouter.access.save')}
              </button>
            </div>
          </>
        ) : (
          <p className='Apps_section_note'>{t('apps.tplinkRouter.access.unavailable')}</p>
        )}
      </div>

      <div className='Tplink_Router_Block'>
        <span className='Tplink_Router_Box_Title'>{t('apps.tplinkRouter.access.blocked', { count: router.blocked.length })}</span>
        {router.blocked.length ? (
          <div className='Tplink_Router_Rows'>
            {router.blocked.map((device) => (
              <div key={device.mac} className='Tplink_Router_Row'>
                <div className='Tplink_Router_Row_Info'>
                  <span className='Tplink_Router_Row_Title'>{device.name || t('apps.tplinkRouter.devices.noName')}</span>
                  <span className='Tplink_Router_Row_Meta'>{device.mac}</span>
                </div>
                <div className='Apps_footer Tplink_Router_Row_Actions'>
                  <button type='button' onClick={() => void onAction({ action: 'unblock', mac: device.mac, name: device.name })} disabled={Boolean(running)}>
                    {running === 'unblock' ? t('apps.tplinkRouter.working') : t('apps.tplinkRouter.access.unblock')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className='Apps_section_note'>{t('apps.tplinkRouter.access.noneBlocked')}</p>
        )}
      </div>
    </div>
  );
};

export default Tplink_Router_Access;
