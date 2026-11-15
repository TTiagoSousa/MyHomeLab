import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './Server_Modal.scss';
import Global_Input from '../../Inputs/Global_Input/Global_Input';
import type { ServerEntry, ServerPayload } from '../../../Hooks/Servers/useServers';
import type { ServerKindInfo } from '../../../Constants/serverKinds';

interface Server_Modal_Props {
  kind: ServerKindInfo;
  existing: ServerEntry | null;
  saving: boolean;
  onSave: (payload: ServerPayload) => Promise<string | null>;
  onClose: () => void;
}

const TOKEN_ID_PATTERN = /^[^@\s]+@[^!\s]+![^\s]+$/;

const GUIDE_STEPS = ['step1', 'step2', 'step3', 'step4', 'step5'] as const;

const proxmoxUrl = (host: string, port: string) => {
  const clean = host.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
  return clean ? `https://${clean}:${port.trim() || '8006'}` : null;
};

const Server_Modal = ({ kind, existing, saving, onSave, onClose }: Server_Modal_Props) => {
  const { t } = useTranslation('settings');
  const [name, setName] = useState(existing?.name ?? '');
  const [host, setHost] = useState(existing?.host ?? '');
  const [port, setPort] = useState(String(existing?.port ?? kind.defaultPort ?? 8006));
  const [tokenId, setTokenId] = useState(existing?.tokenId ?? '');
  const [tokenSecret, setTokenSecret] = useState('');
  const [verifyTls, setVerifyTls] = useState(existing?.verifyTls ?? false);
  const [error, setError] = useState('');

  const portNumber = Number(port);
  const tokenIdValid = TOKEN_ID_PATTERN.test(tokenId.trim());
  const canSave =
    !saving &&
    name.trim().length > 0 &&
    host.trim().length > 0 &&
    Number.isInteger(portNumber) &&
    portNumber > 0 &&
    portNumber < 65536 &&
    tokenIdValid &&
    (existing ? true : tokenSecret.trim().length >= 8);

  const handleSave = async () => {
    if (!canSave) return;
    setError('');
    const failure = await onSave({
      name: name.trim(),
      host: host.trim(),
      port: portNumber,
      tokenId: tokenId.trim(),
      tokenSecret: tokenSecret.trim() || undefined,
      verifyTls,
    });
    if (failure) setError(failure);
    else onClose();
  };

  const field = (
    id: string,
    label: string,
    value: string,
    onChange: (value: string) => void,
    options: { placeholder?: string; type?: string; hint?: string; invalid?: boolean } = {},
  ) => (
    <div className={`Server_Modal_Field${options.invalid ? ' invalid' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <Global_Input
        id={id}
        type={options.type}
        autoComplete='off'
        value={value}
        placeholder={options.placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setError('');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void handleSave();
        }}
      />
      {options.hint && <span className='Server_Modal_Hint'>{options.hint}</span>}
    </div>
  );

  return (
    <div className='Server_Modal_Overlay' onClick={() => !saving && onClose()}>
      <div className='Server_Modal' onClick={(e) => e.stopPropagation()}>
        <div className='Server_Modal_Head'>
          <span className='Server_Modal_Mark'>{kind.name.charAt(0)}</span>
          <div>
            <span className='Server_Modal_Title'>
              {existing ? t('servers.modal.editTitle', { name: existing.name }) : t('servers.modal.title', { kind: kind.name })}
            </span>
            <span className='Server_Modal_Kind'>{kind.name}</span>
          </div>
        </div>

        <details className='Server_Modal_Guide' open={!existing}>
          <summary>{t('servers.modal.guide.title')}</summary>
          <ol>
            {GUIDE_STEPS.map((step) => (
              <li key={step}>{t(`servers.modal.guide.${step}`)}</li>
            ))}
          </ol>
          <p>{t('servers.modal.guide.readOnly')}</p>
        </details>

        {field('server-name', t('servers.modal.name'), name, setName, { placeholder: t('servers.modal.namePlaceholder') })}

        <div className='Server_Modal_Row'>
          {field('server-host', t('servers.modal.host'), host, setHost, {
            placeholder: t('servers.modal.hostPlaceholder'),
          })}
          {field('server-port', t('servers.modal.port'), port, setPort, { placeholder: '8006' })}
        </div>
        <span className='Server_Modal_Hint Server_Modal_Hint_Row'>
          {t('servers.modal.hostHint')}
          {proxmoxUrl(host, port) && (
            <a href={proxmoxUrl(host, port)!} target='_blank' rel='noreferrer'>
              {t('servers.modal.openProxmox')} ↗
            </a>
          )}
        </span>

        {field('server-token-id', t('servers.modal.tokenId'), tokenId, setTokenId, {
          placeholder: t('servers.modal.tokenIdPlaceholder'),
          hint: t('servers.modal.tokenIdHint'),
          invalid: tokenId.trim().length > 0 && !tokenIdValid,
        })}

        {field('server-token-secret', t('servers.modal.tokenSecret'), tokenSecret, setTokenSecret, {
          type: 'password',
          placeholder: existing ? t('servers.modal.keepSecret') : t('servers.modal.secretPlaceholder'),
          hint: t('servers.modal.secretHint'),
        })}

        <label className='Server_Modal_Check'>
          <span>
            {t('servers.modal.verifyTls')}
            <small>{t('servers.modal.verifyTlsHint')}</small>
          </span>
          <input type='checkbox' checked={verifyTls} onChange={(e) => setVerifyTls(e.target.checked)} />
        </label>

        {error && <p className='Server_Modal_Error'>{error}</p>}

        <div className='Server_Modal_Actions'>
          <button type='button' className='Cancel_Button' onClick={onClose} disabled={saving}>
            {t('common:actions.cancel')}
          </button>
          <button type='button' className='Save_Button' onClick={() => void handleSave()} disabled={!canSave}>
            {saving ? t('servers.modal.testing') : t('servers.modal.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Server_Modal;
