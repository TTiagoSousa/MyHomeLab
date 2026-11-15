import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Global_Input from '../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import { End_Points } from '../../../Service/endPoints';
import { BASE_URL } from '../../../config/urls';
import { RELATION_KINDS, type RelationKind, type TaskDetail } from '../../../Hooks/Board/boardTypes';
import * as Icon from '../../../Imports/icons';

const formatSize = (bytes: number) =>
  bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

interface Task_Relations_Props {
  task: TaskDetail;
  saving: boolean;
  onRelate: (taskRef: string, kind: RelationKind) => Promise<boolean>;
  onUnrelate: (relationId: string) => void;
  onAttach: (file: File) => Promise<boolean>;
  onRemoveAttachment: (attachmentId: string) => void;
}

const Task_Relations = ({ task, saving, onRelate, onUnrelate, onAttach, onRemoveAttachment }: Task_Relations_Props) => {
  const { t } = useTranslation('tasks');
  const navigate = useNavigate();
  const [other, setOther] = useState('');
  const [kind, setKind] = useState<RelationKind>('RELATES');
  const fileInput = useRef<HTMLInputElement>(null);

  const relate = async () => {
    if (other.trim() && (await onRelate(other.trim(), kind))) setOther('');
  };

  return (
    <div className='Task_Links'>
      <div className='Task_Links_Group'>
        <span className='Tasks_Label'>{t('relations.title')}</span>
        {task.relations.length === 0 && <p className='Tasks_Note'>{t('relations.none')}</p>}
        {task.relations.map((relation) => (
          <div key={relation.id} className='Task_Link_Row'>
            <button type='button' className='Task_Link_Open' onClick={() => navigate(`/MyHomeLab/Projects/${relation.task.id}`)}>
              <small className='Task_Relation_Kind'>{t(`relations.${relation.direction}.${relation.kind}`)}</small>
              <span className='Task_Card_Key'>{relation.task.key}</span>
              <span>{relation.task.title}</span>
              <span className='Tasks_State_Pill'>
                <span className='Tasks_State_Dot' style={{ background: relation.task.state.color }} />
                {relation.task.state.name}
              </span>
            </button>
            <button type='button' className='Task_Link_Remove' onClick={() => onUnrelate(relation.id)} aria-label={t('detail.unlink')}>
              <Icon.Close />
            </button>
          </div>
        ))}
        <div className='Task_Link_Add'>
          <Global_Dropdown value={kind} options={RELATION_KINDS.map((value) => ({ value, label: t(`relations.from.${value}`) }))} onChange={(value) => setKind(value as RelationKind)} />
          <Global_Input value={other} placeholder={t('relations.placeholder')} onChange={(e) => setOther(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void relate()} />
          <button type='button' className='Tasks_Ghost' onClick={() => void relate()} disabled={saving || !other.trim()}>
            {t('relations.add')}
          </button>
        </div>
      </div>

      <div className='Task_Links_Group'>
        <span className='Tasks_Label'>{t('attachments.title')}</span>
        {task.attachments.length === 0 && <p className='Tasks_Note'>{t('attachments.none')}</p>}
        {task.attachments.map((attachment) => (
          <div key={attachment.id} className='Task_Link_Row'>
            <a className='Task_Link_Open' href={`${BASE_URL}${End_Points.Board_Attachment_Endpoint(attachment.id)}`} target='_blank' rel='noreferrer'>
              <Icon.Doc />
              <span>{attachment.name}</span>
              <small>{formatSize(attachment.size)}</small>
            </a>
            <button type='button' className='Task_Link_Remove' onClick={() => onRemoveAttachment(attachment.id)} aria-label={t('detail.unlink')}>
              <Icon.Close />
            </button>
          </div>
        ))}
        <input
          ref={fileInput}
          type='file'
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) await onAttach(file);
            e.target.value = '';
          }}
        />
        <button type='button' className='Tasks_Ghost' onClick={() => fileInput.current?.click()} disabled={saving}>
          <Icon.Plus />
          <span>{t('attachments.add')}</span>
        </button>
        <span className='Tasks_Hint'>{t('attachments.hint')}</span>
      </div>
    </div>
  );
};

export default Task_Relations;
