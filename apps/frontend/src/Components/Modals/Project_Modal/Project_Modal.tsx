import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../Server_Modal/Server_Modal.scss';
import '../Schedule_Modal/Schedule_Modal.scss';
import './Project_Modal.scss';
import Global_Input from '../../Inputs/Global_Input/Global_Input';
import type { BoardProject, ProjectPayload } from '../../../Hooks/Board/boardTypes';
import type { ScheduleAgent } from '../../../Hooks/Schedules/scheduleTypes';

interface Project_Modal_Props {
  existing: BoardProject | null;
  agents: ScheduleAgent[];
  saving: boolean;
  onSave: (payload: ProjectPayload) => Promise<string | null>;
  onClose: () => void;
}

const Project_Modal = ({ existing, agents, saving, onSave, onClose }: Project_Modal_Props) => {
  const { t } = useTranslation('tasks');
  const [name, setName] = useState(existing?.name ?? '');
  const [identifier, setIdentifier] = useState(existing?.identifier ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [agentKeys, setAgentKeys] = useState<string[]>(existing?.agentKeys ?? []);
  const [error, setError] = useState('');

  const canSave = !saving && name.trim().length > 0;

  const toggleAgent = (key: string) =>
    setAgentKeys((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));

  const handleSave = async () => {
    if (!canSave) return;
    setError('');
    const failure = await onSave({ name: name.trim(), identifier: identifier.trim() || undefined, description: description.trim(), agentKeys });
    if (failure) setError(failure);
    else onClose();
  };

  return (
    <div className='Server_Modal_Overlay' onClick={() => !saving && onClose()}>
      <div className='Server_Modal Schedule_Modal Project_Modal' onClick={(e) => e.stopPropagation()}>
        <div className='Server_Modal_Head'>
          <span className='Server_Modal_Mark'>P</span>
          <div>
            <span className='Server_Modal_Title'>{existing ? t('projectModal.editTitle') : t('projectModal.title')}</span>
            <span className='Server_Modal_Kind'>{t('projectModal.kind')}</span>
          </div>
        </div>

        <div className='Server_Modal_Field'>
          <label htmlFor='project-name'>{t('projectModal.name')}</label>
          <Global_Input
            id='project-name'
            autoComplete='off'
            value={name}
            maxLength={80}
            placeholder={t('projectModal.namePlaceholder')}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className='Server_Modal_Field'>
          <label htmlFor='project-identifier'>{t('projectModal.identifier')}</label>
          <Global_Input
            id='project-identifier'
            autoComplete='off'
            value={identifier}
            maxLength={6}
            placeholder={t('projectModal.identifierPlaceholder')}
            onChange={(e) => setIdentifier(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          />
          <span className='Server_Modal_Hint'>{t('projectModal.identifierHint')}</span>
        </div>

        <div className='Server_Modal_Field'>
          <label htmlFor='project-description'>{t('projectModal.description')}</label>
          <textarea
            id='project-description'
            className='Schedule_Modal_Text'
            rows={4}
            maxLength={4000}
            value={description}
            placeholder={t('projectModal.descriptionPlaceholder')}
            onChange={(e) => setDescription(e.target.value)}
          />
          <span className='Server_Modal_Hint'>{t('projectModal.descriptionHint')}</span>
        </div>

        <div className='Server_Modal_Field'>
          <label>{t('projectModal.agents')}</label>
          <div className='Project_Modal_Agents'>
            {agents.map((agent) => (
              <button
                key={agent.key}
                type='button'
                className={agentKeys.includes(agent.key) ? 'active' : ''}
                aria-pressed={agentKeys.includes(agent.key)}
                onClick={() => toggleAgent(agent.key)}
              >
                {agent.name}
              </button>
            ))}
          </div>
          <span className='Server_Modal_Hint'>{t('projectModal.agentsHint')}</span>
        </div>

        {error && <p className='Server_Modal_Error'>{error}</p>}

        <div className='Server_Modal_Actions'>
          <button type='button' className='Cancel_Button' onClick={onClose} disabled={saving}>
            {t('common:actions.cancel')}
          </button>
          <button type='button' className='Save_Button' onClick={() => void handleSave()} disabled={!canSave}>
            {saving ? t('projectModal.saving') : t('projectModal.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Project_Modal;
