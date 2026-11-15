import { useTranslation } from 'react-i18next';
import type { DocVersionSummary } from '../../../Hooks/Docs/docTypes';
import { authorLabel, formatVersionDate } from './docFormat';

interface Doc_Versions_Props {
  versions: DocVersionSummary[];
  onView: (versionId: string) => void;
}

const Doc_Versions = ({ versions, onView }: Doc_Versions_Props) => {
  const { t } = useTranslation('docs');

  return (
    <section className='Doc_Versions'>
      <span className='Doc_Versions_Title'>{t('versions.title')}</span>
      {versions.length === 0 ? (
        <p className='Doc_Versions_Empty'>{t('versions.empty')}</p>
      ) : (
        <ul>
          {versions.map((version) => (
            <li key={version.id}>
              <div className='Doc_Versions_Info'>
                <span className='Doc_Versions_Date'>{formatVersionDate(version.createdAt)}</span>
                <span className='Doc_Versions_Meta'>
                  {version.title} · {t('versions.by', { by: authorLabel(version.editedBy, t) })}
                </span>
              </div>
              <button type='button' onClick={() => onView(version.id)}>
                {t('versions.view')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default Doc_Versions;
