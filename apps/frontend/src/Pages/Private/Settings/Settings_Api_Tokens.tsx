import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../Components/Inputs/Global_Input/Global_Input';
import { useApiTokens, type ApiTokenScope } from '../../../Hooks/Settings/useApiTokens';
import { dateLocale } from '../../../i18n';
import './Settings_Api_Tokens.scss';

const SCOPES: ApiTokenScope[] = ['READ', 'FULL'];
const EXPIRIES = [30, 90, 365, 0];

const when = (value: string) =>
  new Date(value).toLocaleString(dateLocale(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const Settings_Api_Tokens = () => {
  const { t } = useTranslation('settings');
  const { tokens, loading, saving, error, createToken, revokeToken } = useApiTokens();
  const [name, setName] = useState('');
  const [scope, setScope] = useState<ApiTokenScope>('READ');
  const [expiry, setExpiry] = useState(90);
  const [created, setCreated] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  const handleCreate = async () => {
    const token = await createToken(name.trim(), scope, expiry || null);
    if (!token) return;
    setCreated(token);
    setCopied(false);
    setName('');
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(created);
    setCopied(true);
  };

  return (
    <div className='Settings_section Api_Tokens'>
      <div className='Settings_section_title'>{t('apiTokens.title')}</div>
      <p className='Settings_section_description'>{t('apiTokens.description')}</p>

      <form
        className='Api_Tokens_Form'
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim() && !saving) void handleCreate();
        }}
      >
        <Global_Input
          id='settings-api-token-name'
          value={name}
          maxLength={60}
          placeholder={t('apiTokens.namePlaceholder')}
          onChange={(event) => setName(event.target.value)}
        />
        <div className='Api_Tokens_Scopes' role='radiogroup' aria-label={t('apiTokens.scope')}>
          {SCOPES.map((option) => (
            <button
              key={option}
              type='button'
              role='radio'
              aria-checked={scope === option}
              className={scope === option ? 'active' : ''}
              onClick={() => setScope(option)}
            >
              {t(`apiTokens.scopes.${option}`)}
            </button>
          ))}
        </div>
        <select
          className='Api_Tokens_Expiry'
          aria-label={t('apiTokens.expiry')}
          value={expiry}
          onChange={(event) => setExpiry(Number(event.target.value))}
        >
          {EXPIRIES.map((days) => (
            <option key={days} value={days}>
              {days ? t('apiTokens.expiresIn', { count: days }) : t('apiTokens.never')}
            </option>
          ))}
        </select>
        <button type='submit' className='Api_Tokens_Create' disabled={saving || !name.trim()}>
          {t('apiTokens.create')}
        </button>
      </form>
      <p className='Api_Tokens_Hint'>{t(`apiTokens.scopeHints.${scope}`)}</p>

      {created && (
        <div className='Api_Tokens_Created' role='status'>
          <p>{t('apiTokens.createdOnce')}</p>
          <div className='Api_Tokens_Secret'>
            <code>{created}</code>
            <button type='button' onClick={() => void handleCopy()}>
              {copied ? t('apiTokens.copied') : t('apiTokens.copy')}
            </button>
            <button type='button' className='ghost' onClick={() => setCreated('')}>
              {t('common:actions.close')}
            </button>
          </div>
        </div>
      )}

      {error && <p className='Settings_weather_error' role='alert'>{error}</p>}

      {!loading && (
        <ul className='Api_Tokens_List'>
          {!tokens.length && <li className='Api_Tokens_Empty'>{t('apiTokens.empty')}</li>}
          {tokens.map((token) => (
            <li key={token.id}>
              <div className='Api_Tokens_Info'>
                <strong>{token.name}</strong>
                <span className={`Api_Tokens_Badge ${token.scope === 'FULL' ? 'full' : ''}`}>{t(`apiTokens.scopes.${token.scope}`)}</span>
                <code>{token.prefix}…</code>
              </div>
              <div className='Api_Tokens_Meta'>
                <span>{t('apiTokens.createdAt', { date: when(token.createdAt) })}</span>
                <span>{token.lastUsedAt ? t('apiTokens.lastUsed', { date: when(token.lastUsedAt) }) : t('apiTokens.neverUsed')}</span>
                <span>{token.expiresAt ? t('apiTokens.expires', { date: when(token.expiresAt) }) : t('apiTokens.noExpiry')}</span>
              </div>
              {confirming === token.id ? (
                <div className='Api_Tokens_Actions'>
                  <button type='button' className='danger' disabled={saving} onClick={() => void revokeToken(token.id)}>
                    {t('apiTokens.confirmRevoke')}
                  </button>
                  <button type='button' className='ghost' onClick={() => setConfirming(null)}>
                    {t('common:actions.cancel')}
                  </button>
                </div>
              ) : (
                <div className='Api_Tokens_Actions'>
                  <button type='button' className='ghost' onClick={() => setConfirming(token.id)}>
                    {t('apiTokens.revoke')}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Settings_Api_Tokens;
