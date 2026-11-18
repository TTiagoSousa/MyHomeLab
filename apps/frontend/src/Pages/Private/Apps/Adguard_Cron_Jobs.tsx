import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import App_Cron_Jobs from './App_Cron_Jobs';

const Adguard_Cron_Jobs = () => {
  const { t } = useTranslation('addons');
  const { accountId } = useParams();
  const { connectedAccounts } = useConnectedAccounts('ADGUARD');
  const account = connectedAccounts.find((item) => item.id === accountId);

  return (
    <App_Cron_Jobs
      scope={{ kind: 'account', id: accountId }}
      backTo={`/MyHomeLab/Apps/AdGuard/${accountId}`}
      backLabel={account?.displayName ?? account?.appHost ?? 'AdGuard'}
      note={t('cronJobs.adguardNote')}
    />
  );
};

export default Adguard_Cron_Jobs;
