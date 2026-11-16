import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Global_Input from '../../../Components/Inputs/Global_Input/Global_Input';
import { useDocs } from '../../../Hooks/Docs/useDocs';
import type { TaskDetail } from '../../../Hooks/Board/boardTypes';
import * as Icon from '../../../Imports/icons';

const SEARCH_DELAY_MS = 300;

interface Task_Links_Props {
  task: TaskDetail;
  saving: boolean;
  onAddLink: (url: string, title: string) => Promise<boolean>;
  onRemoveLink: (id: string) => void;
  onLinkDoc: (docId: string) => Promise<boolean>;
  onUnlinkDoc: (docId: string) => void;
}

const Task_Links = ({ task, saving, onAddLink, onRemoveLink, onLinkDoc, onUnlinkDoc }: Task_Links_Props) => {
  const { t } = useTranslation('tasks');
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [picking, setPicking] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const { docs } = useDocs({ search, kind: '', linkType: '' });

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchText.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchText]);

  const linked = new Set(task.docs.map((doc) => doc.id));
  const candidates = docs.filter((doc) => !linked.has(doc.id)).slice(0, 8);

  const addLink = async () => {
    if (!url.trim()) return;
    if (await onAddLink(url.trim(), title.trim())) {
      setUrl('');
      setTitle('');
    }
  };

  return (
    <div className='Task_Links'>
      <div className='Task_Links_Group'>
        <span className='Tasks_Label'>{t('detail.docs')}</span>
        {task.docs.length === 0 && <p className='Tasks_Note'>{t('detail.noDocs')}</p>}
        {task.docs.map((doc) => (
          <div key={doc.id} className='Task_Link_Row'>
            <button type='button' className='Task_Link_Open' onClick={() => navigate(`/MyHomeLab/Docs/${doc.id}`)}>
              <Icon.Doc />
              <span>{doc.title}</span>
            </button>
            <button type='button' className='Task_Link_Remove' onClick={() => onUnlinkDoc(doc.id)} aria-label={t('detail.unlink')}>
              <Icon.Close />
            </button>
          </div>
        ))}
        {picking ? (
          <div className='Task_Doc_Picker'>
            <Global_Input value={searchText} placeholder={t('detail.searchDocs')} onChange={(e) => setSearchText(e.target.value)} />
            {candidates.map((doc) => (
              <button
                key={doc.id}
                type='button'
                className='Task_Link_Open'
                disabled={saving}
                onClick={async () => {
                  if (await onLinkDoc(doc.id)) setPicking(false);
                }}
              >
                <Icon.Doc />
                <span>{doc.title}</span>
              </button>
            ))}
            {candidates.length === 0 && <p className='Tasks_Note'>{t('detail.noDocsFound')}</p>}
            <button type='button' className='Tasks_Ghost' onClick={() => setPicking(false)}>
              {t('common:actions.cancel')}
            </button>
          </div>
        ) : (
          <button type='button' className='Tasks_Ghost' onClick={() => setPicking(true)}>
            <Icon.Plus />
            <span>{t('detail.linkDoc')}</span>
          </button>
        )}
      </div>

      <div className='Task_Links_Group'>
        <span className='Tasks_Label'>{t('detail.links')}</span>
        {task.links.length === 0 && <p className='Tasks_Note'>{t('detail.noLinks')}</p>}
        {task.links.map((link) => (
          <div key={link.id} className='Task_Link_Row'>
            <a className='Task_Link_Open' href={link.url} target='_blank' rel='noreferrer'>
              <Icon.World />
              <span>{link.title}</span>
            </a>
            <button type='button' className='Task_Link_Remove' onClick={() => onRemoveLink(link.id)} aria-label={t('detail.unlink')}>
              <Icon.Close />
            </button>
          </div>
        ))}
        <div className='Task_Link_Add'>
          <Global_Input value={url} placeholder='https://…' onChange={(e) => setUrl(e.target.value)} />
          <Global_Input value={title} placeholder={t('detail.linkTitle')} onChange={(e) => setTitle(e.target.value)} />
          <button type='button' className='Tasks_Ghost' onClick={() => void addLink()} disabled={saving || !url.trim()}>
            {t('detail.addLink')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Task_Links;
