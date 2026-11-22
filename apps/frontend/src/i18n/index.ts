import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

export const LANGUAGES = [
  { code: 'pt-PT', name: 'Português', region: 'Portugal' },
  { code: 'en', name: 'English', region: 'International' },
  { code: 'es', name: 'Español', region: 'España' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

const DEFAULT_LANGUAGE: LanguageCode = 'pt-PT';
const STORAGE_KEY = 'language';

const files = import.meta.glob('./locales/*/*.json', { import: 'default' }) as Record<
  string,
  () => Promise<Record<string, unknown>>
>;

const localeFile = (path: string) => /\.\/locales\/([^/]+)\/([^/]+)\.json$/.exec(path);

const namespaces = Object.keys(files)
  .map((path) => localeFile(path))
  .filter((match) => match?.[1] === DEFAULT_LANGUAGE)
  .map((match) => match![2]);

const loadLanguage = async (language: LanguageCode) => {
  if (i18n.hasResourceBundle(language, 'common')) return;
  const bundles = Object.entries(files).filter(([path]) => localeFile(path)?.[1] === language);
  await Promise.all(
    bundles.map(async ([path, load]) => {
      i18n.addResourceBundle(language, localeFile(path)![2], await load(), true, true);
    }),
  );
};

const isLanguage = (value: string | null | undefined): value is LanguageCode =>
  LANGUAGES.some((l) => l.code === value);

const initialLanguage = (): LanguageCode => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (isLanguage(stored)) return stored;

  const browser = (navigator.language || '').toLowerCase();
  if (browser.startsWith('pt')) return 'pt-PT';
  if (browser.startsWith('es')) return 'es';
  if (browser) return 'en';
  return DEFAULT_LANGUAGE;
};

void i18n.use(initReactI18next).init({
  resources: {},
  partialBundledLanguages: true,
  lng: initialLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  ns: namespaces,
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  returnNull: false,
});

document.documentElement.lang = i18n.language;

export const currentLanguage = (): LanguageCode =>
  isLanguage(i18n.language) ? i18n.language : DEFAULT_LANGUAGE;

export const i18nReady = loadLanguage(currentLanguage()).then(() => {
  void loadLanguage(DEFAULT_LANGUAGE);
});

export const setLanguage = async (code: LanguageCode) => {
  await loadLanguage(code);
  await i18n.changeLanguage(code);
  document.documentElement.lang = code;
  localStorage.setItem(STORAGE_KEY, code);
};

export const dateLocale = (): string => {
  const language = currentLanguage();
  if (language === 'en') return 'en-GB';
  if (language === 'es') return 'es-ES';
  return 'pt-PT';
};

export default i18n;
