import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../Forgejo_Account_Modal/Forgejo_Account_Modal.scss';
import Global_Input from '../../Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../Inputs/Global_Dropdown/Global_Dropdown';
import { useConnectedAccount } from '../../../Hooks/ConnectedAccount/useConnectedAccount';
import App_Location_Fields from '../../App_Location_Fields/App_Location_Fields';

type Postgres_Ssl = 'off' | 'on' | 'no-verify';

const SSL_MODES: Postgres_Ssl[] = ['off', 'on', 'no-verify'];

interface Postgres_Account_Modal_Props {
  onClose: () => void;
  onSaved: () => void;
  initialHost?: string;
  initialPort?: string;
  initialDatabase?: string;
  initialUsername?: string;
  initialSsl?: Postgres_Ssl;
}

const Postgres_Account_Modal = ({
  onClose,
  onSaved,
  initialHost = '',
  initialPort = '5432',
  initialDatabase = 'postgres',
  initialUsername = '',
  initialSsl = 'off',
}: Postgres_Account_Modal_Props) => {
  const { t } = useTranslation('addons');
  const [displayName, setDisplayName] = useState('');
  const [serverId, setServerId] = useState('');
  const [vmid, setVmid] = useState('');
  const [host, setHost] = useState(initialHost);
  const [port, setPort] = useState(initialPort);
  const [database, setDatabase] = useState(initialDatabase);
  const [username, setUsername] = useState(initialUsername);
  const [password, setPassword] = useState('');
  const [ssl, setSsl] = useState<Postgres_Ssl>(initialSsl);
  const { createPostgresAccount, loading } = useConnectedAccount();

  const portNumber = Number(port);
  const validPort = Number.isInteger(portNumber) && portNumber > 0 && portNumber <= 65535;
  const canSave = host.trim().length > 0 && validPort && username.trim().length > 0 && password.length > 0;

  const sslOptions = SSL_MODES.map((mode) => ({ value: mode, label: t(`postgresModal.sslModes.${mode}`) }));

  const handleSave = async () => {
    if (!canSave) return;
    const success = await createPostgresAccount({
      serverConnectionId: serverId || undefined,
      guestVmid: serverId && vmid ? Number(vmid) : undefined,
      displayName: displayName.trim() || undefined,
      host: host.trim(),
      port: portNumber,
      database: database.trim() || undefined,
      username: username.trim(),
      password,
      ssl,
    });
    if (success) onSaved();
  };

  return (
    <div className='Forgejo_Account_Modal_Overlay' onClick={onClose}>
      <div className='Forgejo_Account_Modal' onClick={(e) => e.stopPropagation()}>
        <span className='Forgejo_Account_Modal_Title'>{t('postgresModal.title')}</span>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('postgresModal.name')}</label>
          <Global_Input id='postgres-account-name' value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t('postgresModal.namePlaceholder')} />
        </div>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('postgresModal.host')}</label>
          <Global_Input id='postgres-account-host' value={host} onChange={(e) => setHost(e.target.value)} placeholder={t('postgresModal.hostPlaceholder')} />
          <span className='Forgejo_Account_Modal_Hint'>{t('postgresModal.hostHint')}</span>
        </div>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('postgresModal.port')}</label>
          <Global_Input id='postgres-account-port' type='number' min='1' max='65535' value={port} onChange={(e) => setPort(e.target.value)} />
        </div>
        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('postgresModal.database')}</label>
          <Global_Input id='postgres-account-database' value={database} onChange={(e) => setDatabase(e.target.value)} placeholder='postgres' />
        </div>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('postgresModal.username')}</label>
          <Global_Input id='postgres-account-user' value={username} onChange={(e) => setUsername(e.target.value)} placeholder='postgres' autoComplete='off' />
        </div>
        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('postgresModal.password')}</label>
          <Global_Input id='postgres-account-password' type='password' value={password} onChange={(e) => setPassword(e.target.value)} autoComplete='new-password' />
          <span className='Forgejo_Account_Modal_Hint'>{t('postgresModal.passwordHint')}</span>
        </div>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('postgresModal.ssl')}</label>
          <Global_Dropdown id='postgres-account-ssl' value={ssl} options={sslOptions} onChange={(value) => setSsl(value as Postgres_Ssl)} searchable={false} />
          <span className='Forgejo_Account_Modal_Hint'>{t('postgresModal.sslHint')}</span>
        </div>

        <div className='Forgejo_Account_Modal_Location'>
          <App_Location_Fields
            serverId={serverId}
            vmid={vmid}
            onChange={(nextServerId, nextVmid) => {
              setServerId(nextServerId);
              setVmid(nextVmid);
            }}
            className='Forgejo_Account_Modal_Location_Fields'
            fieldClassName='Forgejo_Account_Modal_Field'
            errorClassName='Forgejo_Account_Modal_Hint error'
          />
          <span className='Forgejo_Account_Modal_Hint'>{t('apps.account.location.connectHint')}</span>
        </div>

        <div className='Forgejo_Account_Modal_Actions'>
          <button className='Cancel_Button' onClick={onClose} disabled={loading}>
            {t('common:actions.cancel')}
          </button>
          <button className='Save_Button' onClick={handleSave} disabled={loading || !canSave}>
            {t('postgresModal.connect')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Postgres_Account_Modal;
