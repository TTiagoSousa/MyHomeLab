import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDriveLinks } from '../../../Hooks/GoogleDrive/useDriveLinks';
import type { BoardProject } from '../../../Hooks/Board/boardTypes';
import Global_Input from '../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import * as Icon from '../../../Imports/icons';
import { Apps_Section } from './appsShared';

const KIND_KEYS: Record<string, string> = {
  'application/vnd.google-apps.folder': 'folder',
  'application/vnd.google-apps.spreadsheet': 'sheet',
  'application/vnd.google-apps.document': 'doc',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
};

interface Props {
  accountId: string;
  email: string | null;
  showEmail: boolean;
  projects: BoardProject[];
}

const Google_Drive_Links = ({ accountId, email, showEmail, projects }: Props) => {
  const { t } = useTranslation('addons');
  const { links, loading, saving, addLink, removeLink } = useDriveLinks(accountId);
  const [target, setTarget] = useState('');
  const [projectId, setProjectId] = useState('');
  const [confirming, setConfirming] = useState('');

  const submit = async () => {
    if (!target.trim() || !projectId) return;
    if (await addLink(target.trim(), projectId)) setTarget('');
  };

  const remove = (id: string) => {
    if (confirming !== id) {
      setConfirming(id);
      return;
    }
    setConfirming('');
    removeLink(id);
  };

  return (
    <Apps_Section
      icon={<Icon.GoogleDrive />}
      title={showEmail && email ? t('apps.googleDrive.links.titleFor', { email }) : t('apps.googleDrive.links.title')}
      description={t('apps.googleDrive.links.description')}
    >
      <div className='Drive_Links_Form'>
        <Global_Input
          id={`drive-link-${accountId}`}
          value={target}
          placeholder={t('apps.googleDrive.links.targetPlaceholder')}
          onChange={(e) => setTarget(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
          disabled={saving}
        />
        <Global_Dropdown
          value={projectId}
          placeholder={t('apps.googleDrive.links.projectPlaceholder')}
          options={projects.map((project) => ({ value: project.id, label: project.name }))}
          onChange={setProjectId}
          disabled={saving || !projects.length}
        />
        <button type='button' className='Drive_Links_Add' disabled={saving || !target.trim() || !projectId} onClick={() => void submit()}>
          {t('apps.googleDrive.links.add')}
        </button>
      </div>

      {!projects.length && <p className='Drive_Links_Empty'>{t('apps.googleDrive.links.noProjects')}</p>}

      {!loading && !links.length ? (
        <p className='Drive_Links_Empty'>{t('apps.googleDrive.links.empty')}</p>
      ) : (
        <ul className='Drive_Links_List'>
          {links.map((link) => (
            <li key={link.id}>
              <span className='Drive_Links_Kind'>{t(`apps.googleDrive.kinds.${KIND_KEYS[link.mimeType] ?? 'file'}`)}</span>
              <span className='Drive_Links_Name' title={link.name}>{link.name}</span>
              <span className='Drive_Links_Project'>{link.project.name}</span>
              <button type='button' className={confirming === link.id ? 'danger' : ''} disabled={saving} onClick={() => remove(link.id)}>
                {confirming === link.id ? t('apps.googleDrive.links.confirmRemove') : t('apps.googleDrive.links.remove')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Apps_Section>
  );
};

export default Google_Drive_Links;
