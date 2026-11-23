import './Settings.scss';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, currentLanguage, setLanguage } from '../../../i18n';
import Settings_Weather from './Settings_Weather';

const Settings = () => {
  const { t } = useTranslation('settings');
  const language = currentLanguage();

  return (
    <div className='Settings'>
      <header>
        <div className='Right_Side'>
          <span>{t('title')}</span>
        </div>
      </header>

      <div className='Settings_section'>
        <div className='Settings_section_title'>{t('language.title')}</div>
        <p className='Settings_section_description'>{t('language.description')}</p>

        <div className='Settings_themes'>
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              className={`Settings_theme${language === lang.code ? ' active' : ''}`}
              onClick={() => void setLanguage(lang.code)}
              type='button'
              lang={lang.code}
            >
              <span className='Settings_language_code'>{lang.code.slice(0, 2).toUpperCase()}</span>

              <span className='Settings_theme_text'>
                <span className='Settings_theme_name'>{lang.name}</span>
                <span className='Settings_theme_hint'>{lang.region}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <Settings_Weather />
    </div>
  );
};

export default Settings;
