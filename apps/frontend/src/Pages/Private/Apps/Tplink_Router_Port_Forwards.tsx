import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TplinkRouterData } from '../../../Hooks/ConnectedAccount/useTplinkRouterStatus';
import type { TplinkRouterActionName, TplinkRouterActionPayload } from '../../../Hooks/ConnectedAccount/useTplinkRouterAction';
import Global_Input from '../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Tplink_Router_Confirm from './Tplink_Router_Confirm';
import { yesNo } from './tplinkRouterFormat';

type Protocol = 'TCP' | 'UDP' | 'ALL';

interface Tplink_Router_Port_Forwards_Props {
  router: TplinkRouterData;
  running: TplinkRouterActionName | null;
  onAction: (payload: TplinkRouterActionPayload) => Promise<boolean>;
}

const EMPTY_RULE = { name: '', ip: '', externalPort: '', internalPort: '', protocol: 'ALL' as Protocol };
const PORT_RANGE = /^\d{1,5}(-\d{1,5})?$/;
const PORT = /^\d{1,5}$/;

const Tplink_Router_Port_Forwards = ({ router, running, onAction }: Tplink_Router_Port_Forwards_Props) => {
  const { t } = useTranslation('addons');
  const [rule, setRule] = useState(EMPTY_RULE);

  const canAdd =
    rule.name.trim().length > 0 &&
    rule.ip.trim().length > 0 &&
    PORT_RANGE.test(rule.externalPort.trim()) &&
    (!rule.internalPort.trim() || PORT.test(rule.internalPort.trim()));

  const protocols = (['ALL', 'TCP', 'UDP'] as Protocol[]).map((value) => ({ value, label: t(`apps.tplinkRouter.ports.protocols.${value}`) }));

  const addRule = async () => {
    const saved = await onAction({
      action: 'portForwardAdd',
      name: rule.name.trim(),
      ip: rule.ip.trim(),
      externalPort: rule.externalPort.trim(),
      internalPort: rule.internalPort.trim() || undefined,
      protocol: rule.protocol,
    });
    if (saved) setRule(EMPTY_RULE);
  };

  return (
    <div className='Tplink_Router_Panel'>
      <div className='Tplink_Router_Block'>
        <span className='Tplink_Router_Box_Title'>{t('apps.tplinkRouter.ports.rules', { count: router.portForwards.length })}</span>
        {router.portForwards.length ? (
          <div className='Apps_table_scroll'>
            <table className='Apps_table Tplink_Router_Table'>
              <thead>
                <tr>
                  <th>{t('apps.tplinkRouter.table.name')}</th>
                  <th>{t('apps.tplinkRouter.table.ip')}</th>
                  <th>{t('apps.tplinkRouter.ports.external')}</th>
                  <th>{t('apps.tplinkRouter.ports.internal')}</th>
                  <th>{t('apps.tplinkRouter.ports.protocol')}</th>
                  <th>{t('apps.tplinkRouter.table.state')}</th>
                  <th aria-label={t('apps.tplinkRouter.table.actions')} />
                </tr>
              </thead>
              <tbody>
                {router.portForwards.map((forward) => (
                  <tr key={forward.name}>
                    <td className='name wrap'>{forward.name}</td>
                    <td>{forward.ip}</td>
                    <td>{forward.externalPort}</td>
                    <td>{forward.internalPort || forward.externalPort}</td>
                    <td>{t(`apps.tplinkRouter.ports.protocols.${forward.protocol}`, { defaultValue: forward.protocol })}</td>
                    <td>{yesNo(forward.enabled, t)}</td>
                    <td>
                      <div className='Apps_footer Tplink_Router_Row_Actions'>
                        <Tplink_Router_Confirm
                          danger
                          quiet
                          label={t('apps.tplinkRouter.ports.delete')}
                          confirmLabel={t('apps.tplinkRouter.ports.deleteConfirm')}
                          busy={running === 'portForwardDelete'}
                          disabled={Boolean(running)}
                          onConfirm={() => onAction({ action: 'portForwardDelete', name: forward.name })}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className='Apps_section_note'>{t('apps.tplinkRouter.ports.none')}</p>
        )}
      </div>

      <div className='Tplink_Router_Form'>
        <span className='Tplink_Router_Box_Title'>{t('apps.tplinkRouter.ports.formTitle')}</span>
        <div className='Apps_inline_fields'>
          <div className='Apps_inline_field'>
            <label htmlFor='tplink-forward-name'>{t('apps.tplinkRouter.table.name')}</label>
            <Global_Input
              id='tplink-forward-name'
              value={rule.name}
              onChange={(e) => setRule({ ...rule, name: e.target.value })}
              placeholder={t('apps.tplinkRouter.ports.namePlaceholder')}
              maxLength={64}
            />
          </div>
          <div className='Apps_inline_field'>
            <label htmlFor='tplink-forward-ip'>{t('apps.tplinkRouter.ports.ip')}</label>
            <Global_Input
              id='tplink-forward-ip'
              value={rule.ip}
              onChange={(e) => setRule({ ...rule, ip: e.target.value })}
              placeholder={t('apps.tplinkRouter.dhcp.ipPlaceholder')}
              maxLength={15}
            />
          </div>
        </div>
        <div className='Apps_inline_fields'>
          <div className='Apps_inline_field'>
            <label htmlFor='tplink-forward-external'>{t('apps.tplinkRouter.ports.external')}</label>
            <Global_Input
              id='tplink-forward-external'
              value={rule.externalPort}
              onChange={(e) => setRule({ ...rule, externalPort: e.target.value })}
              placeholder={t('apps.tplinkRouter.ports.externalPlaceholder')}
              maxLength={11}
            />
          </div>
          <div className='Apps_inline_field'>
            <label htmlFor='tplink-forward-internal'>{t('apps.tplinkRouter.ports.internal')}</label>
            <Global_Input
              id='tplink-forward-internal'
              value={rule.internalPort}
              onChange={(e) => setRule({ ...rule, internalPort: e.target.value })}
              placeholder={t('apps.tplinkRouter.ports.internalPlaceholder')}
              maxLength={5}
            />
          </div>
          <div className='Apps_inline_field'>
            <label>{t('apps.tplinkRouter.ports.protocol')}</label>
            <Global_Dropdown
              value={rule.protocol}
              options={protocols}
              onChange={(value) => setRule({ ...rule, protocol: value as Protocol })}
              searchable={false}
            />
          </div>
        </div>
        <p className='Apps_section_note'>{t('apps.tplinkRouter.ports.hint')}</p>
        <div className='Apps_footer'>
          <button type='button' onClick={() => setRule(EMPTY_RULE)} disabled={Boolean(running)}>
            {t('apps.tplinkRouter.ports.clear')}
          </button>
          <button type='button' className='primary' onClick={() => void addRule()} disabled={Boolean(running) || !canAdd}>
            {running === 'portForwardAdd' ? t('apps.tplinkRouter.working') : t('apps.tplinkRouter.ports.add')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Tplink_Router_Port_Forwards;
