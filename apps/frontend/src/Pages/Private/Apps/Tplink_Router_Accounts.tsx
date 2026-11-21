import './Apps.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import Tplink_Router_Account_Modal from '../../../Components/Modals/Tplink_Router_Account_Modal/Tplink_Router_Account_Modal';
import { Apps_Account_Card, Apps_Empty_Card, Apps_Page } from './appsShared';
import { accountKind } from './tplinkRouterFormat';

const Tplink_Router_Accounts = () => {
  const { t } = useTranslation('addons');
  const navigate = useNavigate();
  const { connectedAccounts, fetchConnectedAccounts } = useConnectedAccounts('TPLINK_ROUTER');
  const [connecting, setConnecting] = useState(false);

  return (
    <Apps_Page title={t('apps.tplinkRouter.title')} onAdd={() => setConnecting(true)} addLabel={t('apps.tplinkRouter.connect')}>
      {connectedAccounts.length ? (
        connectedAccounts.map((account) => (
          <Apps_Account_Card
            key={account.id}
            avatar={account.displayName ?? 'TP'}
            title={account.displayName ?? t('apps.tplinkRouter.title')}
            meta={account.appHost ?? ''}
            chips={
              <>
                <span className='Apps_chip'>{t(`apps.tplinkRouter.kinds.${accountKind(account.scopes)}`)}</span>
                {account.appLatestVersion && (
                  <span className='Apps_chip update'>{t('apps.tplinkRouter.updateChip', { version: account.appLatestVersion })}</span>
                )}
              </>
            }
            onOpen={() => navigate(`/MyHomeLab/Apps/TplinkRouter/${account.id}`)}
          />
        ))
      ) : (
        <Apps_Empty_Card label={t('apps.tplinkRouter.connect')} onAdd={() => setConnecting(true)} />
      )}
      <p className='Apps_section_note'>{t('apps.tplinkRouter.agentsNote')}</p>

      {connecting && (
        <Tplink_Router_Account_Modal
          onClose={() => setConnecting(false)}
          onSaved={() => {
            setConnecting(false);
            fetchConnectedAccounts();
          }}
        />
      )}
    </Apps_Page>
  );
};

export default Tplink_Router_Accounts;
