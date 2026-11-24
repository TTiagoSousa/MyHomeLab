import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import { useHealthForms } from '../../../Hooks/Health/useHealthForms';
import type { New_Today_Shortcut, Today_Shortcut_Kind } from '../../../Hooks/Today/useTodayShortcuts';
import { APP_PAGES } from '../../../Constants/appPages';
import { APP_KINDS } from '../Apps/appsCatalog';

interface Today_Shortcut_Modal_Props {
  onClose: () => void;
  onSave: (shortcut: New_Today_Shortcut) => Promise<string>;
}

const KINDS: Today_Shortcut_Kind[] = ['APP', 'EMAIL_RULES', 'LINK', 'HEALTH_FORM', 'INTAKES'];

const Today_Shortcut_Modal = ({ onClose, onSave }: Today_Shortcut_Modal_Props) => {
  const { t } = useTranslation('tasks');
  const { connectedAccounts } = useConnectedAccounts();
  const [kind, setKind] = useState<Today_Shortcut_Kind>('APP');
  const { forms } = useHealthForms();
  const [accountId, setAccountId] = useState('');
  const [formId, setFormId] = useState('');
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const appOptions = connectedAccounts
    .filter((account) => APP_PAGES[account.provider])
    .map((account) => {
      const appName = t(`addons:${APP_KINDS[account.provider].titleKey}`);
      const own = [account.displayName, account.emailAddress].find((name) => name && name !== appName);
      return { value: account.id, label: own ? `${appName} · ${own}` : appName };
    });

  const ready =
    (kind === 'APP' && accountId) ||
    kind === 'EMAIL_RULES' ||
    kind === 'INTAKES' ||
    (kind === 'HEALTH_FORM' && formId) ||
    (kind === 'LINK' && label.trim() && url.trim());

  const handleSave = async () => {
    if (!ready) return;
    setSaving(true);
    const problem = await onSave(
      kind === 'APP'
        ? { kind, accountId }
        : kind === 'HEALTH_FORM'
          ? { kind, formId }
          : kind === 'LINK'
            ? { kind, label: label.trim(), url: url.trim() }
            : { kind },
    );
    setSaving(false);
    if (problem) setError(problem);
    else onClose();
  };

  return (
    <div className='Today_Modal_Overlay' onClick={onClose}>
      <div className='Today_Modal' role='dialog' aria-modal='true' aria-labelledby='today-shortcut-title' onClick={(e) => e.stopPropagation()}>
        <span className='Today_Modal_Title' id='today-shortcut-title'>{t('today.shortcuts.addTitle')}</span>

        <div className='Today_Modal_Kinds' role='radiogroup'>
          {KINDS.map((option) => (
            <button
              key={option}
              type='button'
              role='radio'
              aria-checked={kind === option}
              className={kind === option ? 'active' : ''}
              onClick={() => { setKind(option); setError(''); }}
            >
              {t(`today.shortcuts.kinds.${option}`)}
            </button>
          ))}
        </div>

        <div className='Today_Modal_Body'>
        {kind === 'APP' && (
          <div className='Today_Modal_Field'>
            <label htmlFor='today-shortcut-app'>{t('today.shortcuts.app')}</label>
            {appOptions.length ? (
              <Global_Dropdown
                id='today-shortcut-app'
                value={accountId}
                onChange={setAccountId}
                options={appOptions}
                placeholder={t('today.shortcuts.appPlaceholder')}
                searchable
              />
            ) : (
              <p className='Today_Modal_Hint'>{t('today.shortcuts.noApps')}</p>
            )}
          </div>
        )}

        {kind === 'EMAIL_RULES' && <p className='Today_Modal_Hint'>{t('today.shortcuts.emailRulesHint')}</p>}

        {kind === 'INTAKES' && <p className='Today_Modal_Hint'>{t('today.shortcuts.intakesHint')}</p>}

        {kind === 'HEALTH_FORM' && (
          <div className='Today_Modal_Field'>
            <label htmlFor='today-shortcut-form'>{t('today.shortcuts.form')}</label>
            {forms.length ? (
              <Global_Dropdown
                id='today-shortcut-form'
                value={formId}
                onChange={setFormId}
                options={forms.map((form) => ({ value: form.id, label: form.name }))}
                placeholder={t('today.shortcuts.formPlaceholder')}
              />
            ) : (
              <p className='Today_Modal_Hint'>{t('today.shortcuts.noForms')}</p>
            )}
          </div>
        )}

        {kind === 'LINK' && (
          <>
            <div className='Today_Modal_Field'>
              <label htmlFor='today-shortcut-label'>{t('today.shortcuts.label')}</label>
              <Global_Input id='today-shortcut-label' value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} placeholder={t('today.shortcuts.labelPlaceholder')} />
            </div>
            <div className='Today_Modal_Field'>
              <label htmlFor='today-shortcut-url'>{t('today.shortcuts.url')}</label>
              <Global_Input id='today-shortcut-url' value={url} onChange={(e) => setUrl(e.target.value)} placeholder='https://' />
            </div>
          </>
        )}

        </div>

        {error && <p className='Today_Modal_Error' role='alert'>{error}</p>}

        <div className='Today_Modal_Actions'>
          <button type='button' className='Today_Ghost_Button' onClick={onClose} disabled={saving}>
            {t('common:actions.cancel')}
          </button>
          <button type='button' className='Today_Solid_Button' onClick={handleSave} disabled={saving || !ready}>
            {saving ? t('common:state.saving') : t('today.shortcuts.add')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Today_Shortcut_Modal;
