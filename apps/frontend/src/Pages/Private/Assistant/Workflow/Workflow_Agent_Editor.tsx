import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Agent, AgentConfig, AgentEffort, AgentModel } from '../../../../Hooks/Agent/useAgents';
import type { AgentToolOption } from '../../../../Hooks/Agent/useAgentTools';
import { useTeamAgent } from '../../../../Hooks/Agent/useTeamAgent';
import Agent_Prompt_Styles from '../../../../Components/Agent_Prompts/Agent_Prompt_Styles';
import Agent_Prompt_Preview from '../../../../Components/Agent_Prompts/Agent_Prompt_Preview';
import Workflow_Tool_Picker from './Workflow_Tool_Picker';
import { AGENT_COLORS, teamBelow } from './workflowTeam';

const MODELS: AgentModel[] = ['OPUS', 'SONNET'];
const EFFORTS: AgentEffort[] = ['LOW', 'MEDIUM', 'HIGH'];
const MAX_PROMPT = 20000;
const MAX_EXTRA = 4000;

const normalize = (text: string) => text.replace(/\r\n/g, '\n').trim();

const configOf = (agent: Agent): AgentConfig => ({
  name: agent.name,
  description: agent.description,
  prompt: agent.prompt,
  extraPrompt: agent.extraPrompt ?? '',
  model: agent.model,
  effort: agent.effort,
  tools: agent.tools,
  reportsToId: agent.reportsToId,
  color: agent.color,
  isActive: agent.isActive,
});

const blankConfig = (agents: Agent[]): AgentConfig => {
  const used = agents.map((agent) => agent.color);
  return {
    name: '',
    description: '',
    prompt: '',
    extraPrompt: '',
    model: 'SONNET',
    effort: 'LOW',
    tools: [],
    reportsToId: agents.find((agent) => agent.isRoot)?.id ?? null,
    color: AGENT_COLORS.find((color) => !used.includes(color)) ?? 6,
    isActive: true,
  };
};

const sameConfigValue = (a: unknown, b: unknown) =>
  Array.isArray(a) && Array.isArray(b)
    ? a.length === b.length && a.every((entry) => b.includes(entry))
    : typeof a === 'string' && typeof b === 'string'
      ? normalize(a) === normalize(b)
      : a === b;

interface Workflow_Agent_Editor_Props {
  agent: Agent | null;
  agents: Agent[];
  tools: AgentToolOption[];
  onSaved: (agents: Agent[]) => void;
  onDeleted: (agents: Agent[]) => void;
}

const Workflow_Agent_Editor = ({ agent, agents, tools, onSaved, onDeleted }: Workflow_Agent_Editor_Props) => {
  const { t } = useTranslation('assistant');
  const { saving, createAgent, updateAgent, deleteAgent } = useTeamAgent();
  const [initial] = useState<AgentConfig>(() => (agent ? configOf(agent) : blankConfig(agents)));
  const [draft, setDraft] = useState<AgentConfig>(initial);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const set = <K extends keyof AgentConfig>(field: K, value: AgentConfig[K]) =>
    setDraft((current) => ({ ...current, [field]: value }));

  const changes = (Object.keys(draft) as (keyof AgentConfig)[]).filter(
    (field) => !sameConfigValue(draft[field], initial[field]),
  );
  const below = agent ? teamBelow(agents, agent.id) : new Set<string>();
  const bosses = agents.filter((member) => !below.has(member.id));
  const boss = agents.find((member) => member.id === agent?.reportsToId);
  const promptIsDefault = agent?.defaultPrompt != null && normalize(draft.prompt) === normalize(agent.defaultPrompt);
  const canSave = draft.name.trim() && draft.description.trim() && draft.prompt.trim() && (!agent || changes.length > 0);

  const save = async () => {
    if (!agent) {
      const team = await createAgent(draft);
      if (team) onSaved(team);
      return;
    }
    const patch = Object.fromEntries(changes.map((field) => [field, draft[field]])) as Partial<AgentConfig>;
    const team = await updateAgent(agent.id, patch);
    if (team) onSaved(team);
  };

  const remove = async () => {
    if (!agent) return;
    const team = await deleteAgent(agent.id);
    if (team) onDeleted(team);
  };

  return (
    <div className='Workflow_Editor'>
      <div className='Workflow_Editor_body'>
        <section className='Workflow_Editor_section'>
          <div className='Workflow_Editor_row'>
            <label className='Workflow_Field grow'>
              <span>{t('workflow.editor.name')}</span>
              <input
                value={draft.name}
                maxLength={60}
                placeholder={t('workflow.editor.namePlaceholder')}
                onChange={(e) => set('name', e.target.value)}
              />
            </label>
            <div className='Workflow_Field'>
              <span>{t('workflow.editor.color')}</span>
              <div className='Workflow_Colors' role='radiogroup' aria-label={t('workflow.editor.color')}>
                {AGENT_COLORS.map((color) => (
                  <button
                    key={color}
                    type='button'
                    role='radio'
                    aria-checked={draft.color === color}
                    aria-label={`${t('workflow.editor.color')} ${color}`}
                    className={`hue-${color}${draft.color === color ? ' on' : ''}`}
                    onClick={() => set('color', color)}
                  />
                ))}
              </div>
            </div>
          </div>

          <label className='Workflow_Field'>
            <span>{t('workflow.editor.description')}</span>
            <textarea
              rows={2}
              value={draft.description}
              maxLength={500}
              placeholder={t('workflow.editor.descriptionPlaceholder')}
              onChange={(e) => set('description', e.target.value)}
            />
            <small>{t('workflow.editor.descriptionHint')}</small>
          </label>

          <div className='Workflow_Editor_row'>
            {agent?.isRoot ? (
              <div className='Workflow_Field grow'>
                <span>{t('workflow.editor.reportsTo')}</span>
                <p className='Workflow_Field_static'>{t('workflow.editor.reportsToRoot')}</p>
              </div>
            ) : (
              <label className='Workflow_Field grow'>
                <span>{t('workflow.editor.reportsTo')}</span>
                <select value={draft.reportsToId ?? ''} onChange={(e) => set('reportsToId', e.target.value)}>
                  {bosses.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!agent?.isRoot && (
              <label className='Workflow_Switch'>
                <input type='checkbox' checked={draft.isActive} onChange={(e) => set('isActive', e.target.checked)} />
                <span>{t('workflow.editor.active')}</span>
              </label>
            )}
          </div>

          <div className='Workflow_Editor_row'>
            <div className='Workflow_Field'>
              <span>{t('workflow.editor.model')}</span>
              <div className='Workflow_Segments'>
                {MODELS.map((model) => (
                  <button key={model} type='button' className={draft.model === model ? 'on' : ''} onClick={() => set('model', model)}>
                    <strong>{t(`workflow.editor.models.${model}`)}</strong>
                    <small>{t(`workflow.editor.modelHints.${model}`)}</small>
                  </button>
                ))}
              </div>
            </div>
            <div className='Workflow_Field'>
              <span>{t('workflow.editor.effort')}</span>
              <div className='Workflow_Segments'>
                {EFFORTS.map((effort) => (
                  <button key={effort} type='button' className={draft.effort === effort ? 'on' : ''} onClick={() => set('effort', effort)}>
                    <strong>{t(`workflow.editor.efforts.${effort}`)}</strong>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className='Workflow_Editor_section'>
          <div className='Workflow_Editor_head'>
            <span className='Workflow_Editor_title'>{t('workflow.editor.prompt')}</span>
            {agent?.defaultPrompt != null && (
              <span className={`Workflow_Editor_tag${promptIsDefault ? '' : ' edited'}`}>
                {promptIsDefault ? t('workflow.editor.promptDefault') : t('workflow.editor.promptEdited')}
              </span>
            )}
          </div>
          <textarea
            className='Workflow_Editor_prompt'
            value={draft.prompt}
            maxLength={MAX_PROMPT}
            spellCheck={false}
            placeholder={t('workflow.editor.promptPlaceholder')}
            onChange={(e) => set('prompt', e.target.value)}
          />
          <div className='Workflow_Editor_meta'>
            <small>{agent?.defaultPrompt != null ? t('workflow.editor.promptHint') : t('workflow.editor.promptHintCustom')}</small>
            {agent?.defaultPrompt != null && (
              <button type='button' className='Workflow_Link' disabled={promptIsDefault} onClick={() => set('prompt', agent.defaultPrompt ?? '')}>
                {t('workflow.editor.resetPrompt')}
              </button>
            )}
          </div>

          {agent?.isRoot && (
            <Agent_Prompt_Styles text={draft.extraPrompt ?? ''} disabled={saving} onChange={(text) => set('extraPrompt', text)} />
          )}
          <label className='Workflow_Field'>
            <span>{t('workflow.editor.extraPrompt')}</span>
            <textarea
              rows={3}
              value={draft.extraPrompt ?? ''}
              maxLength={MAX_EXTRA}
              placeholder={t('workflow.editor.extraPlaceholder')}
              onChange={(e) => set('extraPrompt', e.target.value)}
            />
            <small>{t('workflow.editor.extraHint')}</small>
          </label>
          {agent?.isRoot && <Agent_Prompt_Preview text={draft.extraPrompt ?? ''} />}
        </section>

        <section className='Workflow_Editor_section'>
          <div className='Workflow_Editor_head'>
            <span className='Workflow_Editor_title'>{t('workflow.editor.tools')}</span>
            <span className='Workflow_Editor_count'>{t('workflow.editor.toolsCount', { count: draft.tools.length })}</span>
          </div>
          <small className='Workflow_Editor_hint'>{t('workflow.editor.toolsHint')}</small>
          <Workflow_Tool_Picker tools={tools} selected={draft.tools} disabled={saving} onChange={(next) => set('tools', next)} />
        </section>
      </div>

      <footer className='Workflow_Editor_footer'>
        {agent && !agent.isRoot && (
          confirmingDelete ? (
            <div className='Workflow_Editor_confirm'>
              <span>{t('workflow.editor.deleteHint', { name: boss?.name ?? '' })}</span>
              <button type='button' onClick={() => setConfirmingDelete(false)} disabled={saving}>
                {t('workflow.editor.cancel')}
              </button>
              <button type='button' className='danger' onClick={remove} disabled={saving}>
                {t('workflow.editor.confirmDelete')}
              </button>
            </div>
          ) : (
            <button type='button' className='danger' onClick={() => setConfirmingDelete(true)} disabled={saving}>
              {t('workflow.editor.delete')}
            </button>
          )
        )}
        <div className='Workflow_Editor_actions'>
          {agent && changes.length > 0 && (
            <button type='button' onClick={() => setDraft(initial)} disabled={saving}>
              {t('workflow.editor.discard')}
            </button>
          )}
          <button type='button' className='primary' onClick={save} disabled={saving || !canSave}>
            {saving ? t('workflow.editor.saving') : agent ? t('workflow.editor.save') : t('workflow.editor.create')}
          </button>
        </div>
      </footer>
    </div>
  );
};

export default Workflow_Agent_Editor;
