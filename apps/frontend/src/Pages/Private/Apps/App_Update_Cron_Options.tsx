import { useTranslation } from 'react-i18next';
import Global_Dropdown from '../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import { useBoardProjects } from '../../../Hooks/Board/useBoardProjects';
import type { Cron_Options_Panel_Props } from './App_Cron_Job';

const COLUMNS = ['new', 'study'] as const;

const App_Update_Cron_Options = ({ value, onChange, disabled }: Cron_Options_Panel_Props) => {
  const { t } = useTranslation('addons');
  const { projects } = useBoardProjects();
  const updateProjects = projects.filter((project) => project.kind === 'UPDATES');
  const projectId = typeof value.projectId === 'string' ? value.projectId : '';
  const column = value.column === 'new' ? 'new' : 'study';
  const project = updateProjects.find((item) => item.id === projectId);
  const columnName = (key: string) => project?.states.find((state) => state.key === key)?.name ?? t(`cronJobs.updates.columns.${key}`);

  const set = (patch: Record<string, unknown>) => onChange({ ...value, ...patch });

  const toggleBoard = (board: boolean) =>
    set({ board, projectId: projectId || (updateProjects.length === 1 ? updateProjects[0].id : null), column });

  return (
    <div className='Update_Cron_Options'>
      <label className='Update_Cron_Options_check'>
        <input type='checkbox' checked={value.board === true} onChange={(e) => toggleBoard(e.target.checked)} disabled={disabled} />
        <span>
          {t('cronJobs.updates.board')}
          <small>{t('cronJobs.updates.boardHint')}</small>
        </span>
      </label>

      {value.board === true && (
        <div className='Update_Cron_Options_board'>
          <div className='Update_Cron_Options_row'>
            <label htmlFor='update-cron-project'>{t('cronJobs.updates.project')}</label>
            <Global_Dropdown
              id='update-cron-project'
              value={projectId}
              onChange={(id) => set({ projectId: id || null })}
              options={[
                { value: '', label: t('cronJobs.updates.chooseProject') },
                ...updateProjects.map((item) => ({ value: item.id, label: item.name })),
              ]}
              disabled={disabled}
            />
          </div>
          <div className='Update_Cron_Options_row'>
            <label htmlFor='update-cron-column'>{t('cronJobs.updates.column')}</label>
            <Global_Dropdown
              id='update-cron-column'
              value={column}
              onChange={(key) => set({ column: key })}
              options={COLUMNS.map((key) => ({ value: key, label: columnName(key) }))}
              disabled={disabled}
            />
          </div>
          <p className='Update_Cron_Options_note'>{t(`cronJobs.updates.columnHint.${column}`)}</p>
        </div>
      )}
    </div>
  );
};

export default App_Update_Cron_Options;
