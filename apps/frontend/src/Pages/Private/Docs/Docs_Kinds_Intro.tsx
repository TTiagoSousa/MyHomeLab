import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Icon from '../../../Imports/icons';

const STORAGE_KEY = 'docs.kindsIntro.closed';
const KINDS = ['RULES', 'MAP', 'LOG'] as const;

const readClosed = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

const Docs_Kinds_Intro = () => {
  const { t } = useTranslation('docs');
  const [closed, setClosed] = useState(readClosed);

  if (closed) return null;

  const close = () => {
    setClosed(true);
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      return;
    }
  };

  return (
    <section className='Docs_Kinds_Intro' aria-label={t('intro.title')}>
      <div className='Docs_Kinds_Intro_Head'>
        <span className='Docs_Kinds_Intro_Title'>{t('intro.title')}</span>
        <button type='button' className='Docs_Kinds_Intro_Close' onClick={close} aria-label={t('intro.close')} title={t('intro.close')}>
          <Icon.Close />
        </button>
      </div>
      <div className='Docs_Kinds_Intro_Grid'>
        {KINDS.map((kind) => (
          <div key={kind} className={`Docs_Kinds_Intro_Card ${kind.toLowerCase()}`}>
            <span className='Docs_Kinds_Intro_Name'>{t(`kinds.${kind}`)}</span>
            <span className='Docs_Kinds_Intro_Text'>{t(`intro.${kind}`)}</span>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Docs_Kinds_Intro;
