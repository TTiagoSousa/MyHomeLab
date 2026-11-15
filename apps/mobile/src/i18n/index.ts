import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import ptPT from './locales/pt-PT.json';
import en from './locales/en.json';
import es from './locales/es.json';

const deviceLanguage = () => {
  const code = getLocales()[0]?.languageCode;
  if (code === 'en') return 'en';
  if (code === 'es') return 'es';
  return 'pt-PT';
};

i18n.use(initReactI18next).init({
  resources: {
    'pt-PT': { translation: ptPT },
    en: { translation: en },
    es: { translation: es },
  },
  lng: deviceLanguage(),
  fallbackLng: 'pt-PT',
  interpolation: { escapeValue: false },
});

export const dateLocale = () => (i18n.language === 'pt-PT' ? 'pt-PT' : i18n.language);

export default i18n;
