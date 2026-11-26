import { useParams } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import App_Cron_Jobs from './App_Cron_Jobs';

const App_Account_Cron_Jobs = () => {
  const { app, accountId } = useParams();
  const { connectedAccounts } = useConnectedAccounts();
  const account = connectedAccounts.find((item) => item.id === accountId);

  return (
    <App_Cron_Jobs
      scope={{ kind: 'account', id: accountId }}
      backTo={`/MyHomeLab/Apps/${app}/${accountId}`}
      backLabel={account?.displayName ?? account?.appHost ?? app ?? ''}
    />
  );
};

export default App_Account_Cron_Jobs;
