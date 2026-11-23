import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Page_Help from '../../../Components/Page_Help/Page_Help';
import * as Icon from '../../../Imports/icons';
import { APP_PAGES } from '../../../Constants/appPages';
import { APP_KINDS } from '../Apps/appsCatalog';
import { useTodayShortcuts, type Today_Shortcut } from '../../../Hooks/Today/useTodayShortcuts';
import Today_Weather from './Today_Weather';
import Today_Shortcut_Modal from './Today_Shortcut_Modal';
import './Today.scss';

const EMAIL_RULES_PAGE = '/MyHomeLab/Apps/Gmail/Rules';

const Today = () => {
  const { t } = useTranslation('tasks');
  const navigate = useNavigate();
  const { shortcuts, loading, error, addShortcut, removeShortcut } = useTodayShortcuts();
  const [adding, setAdding] = useState(false);

  const describe = (shortcut: Today_Shortcut) => {
    if (shortcut.kind === 'LINK') {
      return { icon: Icon.World, name: shortcut.label ?? '', hint: shortcut.url ? new URL(shortcut.url).host : '' };
    }
    if (shortcut.kind === 'EMAIL_RULES') {
      return { icon: Icon.Mail, name: t('today.shortcuts.kinds.EMAIL_RULES'), hint: t('today.shortcuts.hints.emailRules') };
    }
    const provider = shortcut.account?.provider;
    const app = provider ? APP_KINDS[provider] : undefined;
    const appName = app ? t(`addons:${app.titleKey}`) : '';
    return {
      icon: app?.icon ?? Icon.Settings,
      name: shortcut.account?.displayName || appName,
      hint: shortcut.account?.displayName && shortcut.account.displayName !== appName ? appName : t('today.shortcuts.hints.app'),
    };
  };

  return (
    <div className='Today'>
      <header>
        <div className='Right_Side'>
          <span>{t('today.title')}</span>
          <Page_Help topic='today' />
        </div>
      </header>

      <Today_Weather />

      <section className='Today_Shortcuts' aria-labelledby='today-shortcuts-title'>
        <div className='Today_Shortcuts_Header'>
          <span id='today-shortcuts-title'>{t('today.shortcuts.title')}</span>
          <button type='button' className='Today_Ghost_Button' onClick={() => setAdding(true)}>
            <Icon.Plus />
            {t('today.shortcuts.add')}
          </button>
        </div>

        {error && <p className='Today_Error' role='alert'>{error}</p>}

        {!loading && !shortcuts.length && !error && (
          <p className='Today_Empty'>{t('today.shortcuts.empty')}</p>
        )}

        <ul className='Today_Shortcuts_Grid'>
          {shortcuts.map((shortcut) => {
            const { icon: ShortcutIcon, name, hint } = describe(shortcut);
            const content = (
              <>
                <span className='Today_Shortcut_Icon'><ShortcutIcon /></span>
                <span className='Today_Shortcut_Text'>
                  <strong>{name}</strong>
                  <span>{hint}{shortcut.kind === 'LINK' && ' ↗'}</span>
                </span>
              </>
            );
            const page = shortcut.kind === 'EMAIL_RULES'
              ? EMAIL_RULES_PAGE
              : shortcut.account ? APP_PAGES[shortcut.account.provider] : undefined;

            return (
              <li key={shortcut.id} className='Today_Shortcut'>
                {shortcut.kind === 'LINK' && shortcut.url ? (
                  <a className='Today_Shortcut_Open' href={shortcut.url} target='_blank' rel='noopener noreferrer'>{content}</a>
                ) : (
                  <button type='button' className='Today_Shortcut_Open' onClick={() => page && navigate(page)} disabled={!page}>{content}</button>
                )}
                <button
                  type='button'
                  className='Today_Shortcut_Remove'
                  aria-label={t('today.shortcuts.remove', { name })}
                  title={t('today.shortcuts.remove', { name })}
                  onClick={() => removeShortcut(shortcut.id)}
                >
                  <Icon.Close />
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {adding && <Today_Shortcut_Modal onClose={() => setAdding(false)} onSave={addShortcut} />}
    </div>
  );
};

export default Today;
