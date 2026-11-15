import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import { STATE_GROUPS, type BoardProject, type StateGroup } from '../../../Hooks/Board/boardTypes';
import { useBoardProjects } from '../../../Hooks/Board/useBoardProjects';
import { useUpdateSetting } from '../../../Hooks/Board/useUpdateSetting';
import { useServers } from '../../../Hooks/Servers/useServers';
import Doc_Tags_Input from '../Docs/Doc_Tags_Input';
import { formatDay } from './taskFormat';
import * as Icon from '../../../Imports/icons';
import '../../../Components/Modals/Server_Modal/Server_Modal.scss';
import '../../../Components/Schedule_Card/Schedule_Tags.scss';

interface Project_Settings_Props {
  project: BoardProject;
  actions: ReturnType<typeof useBoardProjects>;
  onEdit: () => void;
  onClose: () => void;
}

const Project_Settings = ({ project, actions, onEdit, onClose }: Project_Settings_Props) => {
  const { t } = useTranslation('tasks');
  const [stateName, setStateName] = useState('');
  const [stateGroup, setStateGroup] = useState<StateGroup>('UNSTARTED');
  const [moduleName, setModuleName] = useState('');
  const [error, setError] = useState('');
  const [cycleName, setCycleName] = useState('');
  const [cycleStart, setCycleStart] = useState('');
  const [cycleEnd, setCycleEnd] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const updates = project.kind === 'UPDATES';
  const { setting, saveSetting } = useUpdateSetting(updates);
  const { servers } = useServers();

  const report = (failure: string | null) => setError(failure ?? '');

  const groupOptions = STATE_GROUPS.map((value) => ({ value, label: t(`groups.${value}`) }));
  const serverOptions = [{ value: '', label: t('settings.noServer') }, ...servers.map((server) => ({ value: server.id, label: server.name }))];

  return (
    <div className='Server_Modal_Overlay' onClick={onClose}>
      <div className='Server_Modal Project_Settings' onClick={(e) => e.stopPropagation()}>
        <div className='Server_Modal_Head'>
          <span className='Server_Modal_Mark'>{project.identifier.slice(0, 1)}</span>
          <div>
            <span className='Server_Modal_Title'>{project.name}</span>
            <span className='Server_Modal_Kind'>{t('settings.kind', { identifier: project.identifier })}</span>
          </div>
        </div>

        {updates && (
          <div className='Server_Modal_Field'>
            <label>{t('settings.server')}</label>
            <Global_Dropdown
              value={project.serverConnectionId ?? ''}
              options={serverOptions}
              onChange={(value) => void actions.saveProject({ serverConnectionId: value || null }, project.id).then((result) => report(result.failure))}
            />
            <span className='Server_Modal_Hint'>{t('settings.serverHint')}</span>
          </div>
        )}

        {updates && setting && (
          <>
            <div className='Server_Modal_Field Schedule_Tags_Field'>
              <label htmlFor='update-modules'>{t('settings.updateModules')}</label>
              <Doc_Tags_Input id='update-modules' tags={setting.boardModules} onChange={(boardModules) => void saveSetting({ boardModules })} />
              <span className='Server_Modal_Hint'>{t('settings.updateModulesHint')}</span>
            </div>
          </>
        )}

        <div className='Server_Modal_Field'>
          <label>{t('settings.states')}</label>
          <div className='Project_Settings_List'>
            {project.states.map((state, index) => (
              <div key={state.id} className='Project_Settings_Row'>
                <input
                  type='color'
                  value={state.color}
                  aria-label={t('settings.color')}
                  onChange={(e) => void actions.saveState(state.id, { color: e.target.value }).then(report)}
                />
                <input
                  className='Project_Settings_Name'
                  defaultValue={state.name}
                  maxLength={60}
                  aria-label={t('settings.stateName')}
                  onBlur={(e) => e.target.value.trim() && e.target.value !== state.name && void actions.saveState(state.id, { name: e.target.value }).then(report)}
                />
                <input
                  className='Project_Settings_Phase'
                  defaultValue={state.phase ?? ''}
                  maxLength={40}
                  list={`phases-${project.id}`}
                  placeholder={t('settings.phase')}
                  aria-label={t('settings.phase')}
                  onBlur={(e) => e.target.value.trim() !== (state.phase ?? '') && void actions.saveState(state.id, { phase: e.target.value }).then(report)}
                />
                {state.key ? (
                  <span className='Project_Settings_Group'>{t(`groups.${state.group}`)}</span>
                ) : (
                  <div className='Project_Settings_Group'>
                    <Global_Dropdown value={state.group} options={groupOptions} onChange={(value) => void actions.saveState(state.id, { group: value as StateGroup }).then(report)} />
                  </div>
                )}
                <button type='button' onClick={() => void actions.saveState(state.id, { position: index - 1 }).then(report)} disabled={index === 0} aria-label={t('settings.up')}>
                  <Icon.Chevron />
                </button>
                <button
                  type='button'
                  className='down'
                  onClick={() => void actions.saveState(state.id, { position: index + 1 }).then(report)}
                  disabled={index === project.states.length - 1}
                  aria-label={t('settings.down')}
                >
                  <Icon.Chevron />
                </button>
                {!state.key && (
                  <button type='button' className='danger' onClick={() => void actions.deleteState(state.id).then(report)} aria-label={t('settings.remove')}>
                    <Icon.Close />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className='Project_Settings_Add'>
            <Global_Input value={stateName} maxLength={60} placeholder={t('settings.newState')} onChange={(e) => setStateName(e.target.value)} />
            <div className='Project_Settings_Group'>
              <Global_Dropdown value={stateGroup} options={groupOptions} onChange={(value) => setStateGroup(value as StateGroup)} />
            </div>
            <button
              type='button'
              disabled={!stateName.trim()}
              onClick={async () => {
                report(await actions.addState(project.id, stateName.trim(), stateGroup));
                setStateName('');
              }}
            >
              {t('settings.add')}
            </button>
          </div>
          <datalist id={`phases-${project.id}`}>
            {[...new Set(project.states.map((state) => state.phase).filter(Boolean))].map((phase) => (
              <option key={phase} value={phase!} />
            ))}
          </datalist>
          <span className='Server_Modal_Hint'>{t('settings.phaseHint')}</span>
          {updates && <span className='Server_Modal_Hint'>{t('settings.updatesStatesHint')}</span>}
        </div>

        <div className='Server_Modal_Field'>
          <label>{t('settings.modules')}</label>
          <div className='Project_Settings_List'>
            {project.modules.length === 0 && <span className='Server_Modal_Hint'>{t('settings.noModules')}</span>}
            {project.modules.map((module) => (
              <div key={module.id} className='Project_Settings_Row'>
                <input
                  className='Project_Settings_Name'
                  defaultValue={module.name}
                  maxLength={80}
                  aria-label={t('settings.moduleName')}
                  onBlur={(e) => e.target.value.trim() && e.target.value !== module.name && void actions.saveModule(module.id, { name: e.target.value }).then(report)}
                />
                <button type='button' className='danger' onClick={() => void actions.deleteModule(module.id).then(report)} aria-label={t('settings.remove')}>
                  <Icon.Close />
                </button>
              </div>
            ))}
          </div>
          <div className='Project_Settings_Add'>
            <Global_Input value={moduleName} maxLength={80} placeholder={t('settings.newModule')} onChange={(e) => setModuleName(e.target.value)} />
            <button
              type='button'
              disabled={!moduleName.trim()}
              onClick={async () => {
                report(await actions.addModule(project.id, moduleName.trim()));
                setModuleName('');
              }}
            >
              {t('settings.add')}
            </button>
          </div>
        </div>

        <div className='Server_Modal_Field'>
          <label>{t('settings.cycles')}</label>
          <div className='Project_Settings_List'>
            {project.cycles.length === 0 && <span className='Server_Modal_Hint'>{t('settings.noCycles')}</span>}
            {project.cycles.map((cycle) => (
              <div key={cycle.id} className='Project_Settings_Row'>
                <span className='Project_Settings_Name static'>{cycle.name}</span>
                <span className='Project_Settings_Group'>
                  {formatDay(cycle.startDate)} – {formatDay(cycle.endDate)}
                </span>
                <button type='button' className='danger' onClick={() => void actions.deleteCycle(cycle.id).then(report)} aria-label={t('settings.remove')}>
                  <Icon.Close />
                </button>
              </div>
            ))}
          </div>
          <div className='Project_Settings_Add'>
            <Global_Input value={cycleName} maxLength={80} placeholder={t('settings.newCycle')} onChange={(e) => setCycleName(e.target.value)} />
            <Global_Input type='date' value={cycleStart} onChange={(e) => setCycleStart(e.target.value)} />
            <Global_Input type='date' value={cycleEnd} onChange={(e) => setCycleEnd(e.target.value)} />
            <button
              type='button'
              disabled={!cycleName.trim() || !cycleStart || !cycleEnd}
              onClick={async () => {
                report(await actions.addCycle(project.id, cycleName.trim(), `${cycleStart}T00:00:00Z`, `${cycleEnd}T23:59:00Z`));
                setCycleName('');
              }}
            >
              {t('settings.add')}
            </button>
          </div>
        </div>

        {error && <p className='Server_Modal_Error'>{error}</p>}

        <div className='Server_Modal_Actions'>
          {!updates &&
            (confirmDelete ? (
              <button type='button' className='Cancel_Button danger' onClick={async () => {
                const failure = await actions.deleteProject(project.id);
                if (failure) report(failure);
                else onClose();
              }}>
                {t('settings.confirmDelete')}
              </button>
            ) : (
              <button type='button' className='Cancel_Button' onClick={() => setConfirmDelete(true)}>
                {t('settings.deleteProject')}
              </button>
            ))}
          <button type='button' className='Cancel_Button' onClick={onEdit}>
            {t('settings.editProject')}
          </button>
          <button type='button' className='Save_Button' onClick={onClose}>
            {t('settings.done')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Project_Settings;
