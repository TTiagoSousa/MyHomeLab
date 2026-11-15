import { useTranslation } from 'react-i18next';
import type { AgentToolOption } from '../../../../Hooks/Agent/useAgentTools';

interface Workflow_Tool_Picker_Props {
  tools: AgentToolOption[];
  selected: string[];
  disabled: boolean;
  onChange: (tools: string[]) => void;
}

const Workflow_Tool_Picker = ({ tools, selected, disabled, onChange }: Workflow_Tool_Picker_Props) => {
  const { t } = useTranslation('assistant');
  const groups = [...new Set(tools.map((tool) => tool.group))];

  const toggle = (name: string) =>
    onChange(selected.includes(name) ? selected.filter((entry) => entry !== name) : [...selected, name]);

  const toggleGroup = (names: string[]) => {
    const all = names.every((name) => selected.includes(name));
    onChange(all ? selected.filter((name) => !names.includes(name)) : [...new Set([...selected, ...names])]);
  };

  return (
    <div className='Workflow_Tools'>
      {groups.map((group) => {
        const names = tools.filter((tool) => tool.group === group).map((tool) => tool.name);
        const count = names.filter((name) => selected.includes(name)).length;
        return (
          <fieldset key={group} className='Workflow_Tools_group' disabled={disabled}>
            <legend>
              <span>{t(`workflow.toolGroups.${group}`)}</span>
              <button type='button' className={count === names.length ? 'on' : ''} onClick={() => toggleGroup(names)}>
                {count}/{names.length}
              </button>
            </legend>
            {tools
              .filter((tool) => tool.group === group)
              .map((tool) => (
                <label key={tool.name} className='Workflow_Tool'>
                  <input type='checkbox' checked={selected.includes(tool.name)} onChange={() => toggle(tool.name)} />
                  <span className='Workflow_Tool_text'>
                    <span>{t(`workflow.toolNames.${tool.name}`, { defaultValue: tool.name })}</span>
                    <code>{tool.name}</code>
                  </span>
                  <span className={`Workflow_Tool_access ${tool.access}`}>{t(`workflow.editor.${tool.access}`)}</span>
                </label>
              ))}
          </fieldset>
        );
      })}
    </div>
  );
};

export default Workflow_Tool_Picker;
