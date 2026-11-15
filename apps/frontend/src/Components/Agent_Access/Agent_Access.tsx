import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Apps_Section } from '../../Pages/Private/Apps/appsShared';
import { useAgentAccess, type AccessLevel, type AgentAccessRow } from '../../Hooks/Agent/useAgentAccess';
import * as Icon from '../../Imports/icons';
import './Agent_Access.scss';

const LEVELS: AccessLevel[] = ['NONE', 'READ', 'WRITE'];
const ORDER: Record<AccessLevel, number> = { NONE: 0, READ: 1, WRITE: 2 };

interface Agent_Access_Props {
  type: 'APP' | 'SERVER';
  targetId: string;
  label: string;
}

const toolsLevel = (row: AgentAccessRow): AccessLevel => (row.canWrite ? 'WRITE' : row.canRead ? 'READ' : 'NONE');

const effectiveLevel = (row: AgentAccessRow): AccessLevel => {
  const tools = toolsLevel(row);
  return row.level && ORDER[row.level] < ORDER[tools] ? row.level : tools;
};

const Agent_Access = ({ type, targetId, label }: Agent_Access_Props) => {
  const { t } = useTranslation('assistant');
  const navigate = useNavigate();
  const { rows, loading, savingKey, saveLevel } = useAgentAccess(type, targetId);
  const withTools = rows.filter((row) => row.canRead);
  const withoutTools = rows.filter((row) => !row.canRead);

  return (
    <Apps_Section icon={<Icon.Agents />} title={t('access.title')} description={t('access.description', { label })}>
      <div className='Agent_Access'>
        {loading && <p className='Agent_Access_Note'>{t('access.loading')}</p>}
        {!loading && withTools.length === 0 && <p className='Agent_Access_Note'>{t('access.nobody')}</p>}
        {withTools.map((row) => {
          const level = effectiveLevel(row);
          return (
            <div key={row.agentKey} className={`Agent_Access_Row${row.isActive ? '' : ' off'}`}>
              <div className='Agent_Access_Name'>
                <span>{row.name}</span>
                <small>{row.isActive ? (row.level ? t('access.custom') : t('access.fromTools')) : t('access.agentOff')}</small>
              </div>
              <div className='Agent_Access_Levels' role='radiogroup' aria-label={row.name}>
                {LEVELS.map((option) => {
                  const possible = ORDER[option] <= ORDER[toolsLevel(row)];
                  return (
                    <button
                      key={option}
                      type='button'
                      role='radio'
                      aria-checked={level === option}
                      className={level === option ? 'active' : ''}
                      disabled={!possible || savingKey === row.agentKey}
                      title={possible ? undefined : t('access.noTools')}
                      onClick={() => void saveLevel(row.agentKey, option === toolsLevel(row) ? null : option)}
                    >
                      {t(`access.levels.${option}`)}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {withoutTools.length > 0 && <p className='Agent_Access_Note'>{t('access.others', { names: withoutTools.map((row) => row.name).join(', ') })}</p>}
        <div className='Agent_Access_Footer'>
          <span className='Agent_Access_Note'>{t('access.layers')}</span>
          <button type='button' onClick={() => navigate('/MyHomeLab/Assistant/Settings?section=permissions')}>
            {t('access.general')}
          </button>
          <button type='button' onClick={() => navigate('/MyHomeLab/Assistant/Workflow')}>
            {t('access.tools')}
          </button>
        </div>
      </div>
    </Apps_Section>
  );
};

export default Agent_Access;
