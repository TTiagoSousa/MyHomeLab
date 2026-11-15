import { useTranslation } from 'react-i18next';
import Doc_Editor from '../../../Components/Doc_Editor/Doc_Editor';
import type { DocVersion } from '../../../Hooks/Docs/docTypes';
import { authorLabel, formatVersionDate } from './docFormat';

interface Doc_Version_Modal_Props {
  version: DocVersion | null;
  restoring: boolean;
  onRestore: () => void;
  onClose: () => void;
}

const Doc_Version_Modal = ({ version, restoring, onRestore, onClose }: Doc_Version_Modal_Props) => {
  const { t } = useTranslation('docs');

  return (
    <div className='Doc_Version_Modal_Overlay' onClick={() => !restoring && onClose()}>
      <div className='Doc_Version_Modal' role='dialog' onClick={(e) => e.stopPropagation()}>
        <div className='Doc_Version_Modal_Head'>
          <span className='Doc_Version_Modal_Title'>
            {version ? t('versions.modalTitle', { date: formatVersionDate(version.createdAt) }) : t('versions.loading')}
          </span>
          {version && (
            <span className='Doc_Version_Modal_Meta'>
              {version.title} · {t('versions.by', { by: authorLabel(version.editedBy, t) })}
            </span>
          )}
        </div>

        <div className='Doc_Version_Modal_Body'>{version && <Doc_Editor value={version.content} />}</div>

        <div className='Doc_Version_Modal_Actions'>
          <button type='button' className='Cancel_Button' onClick={onClose} disabled={restoring}>
            {t('versions.close')}
          </button>
          <button type='button' className='Save_Button' onClick={onRestore} disabled={!version || restoring}>
            {restoring ? t('versions.restoring') : t('versions.restore')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Doc_Version_Modal;
