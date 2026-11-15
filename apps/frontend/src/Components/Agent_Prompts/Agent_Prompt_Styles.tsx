import { useTranslation } from 'react-i18next';
import './Agent_Prompts.scss';

const STYLE_KEYS = ['direct', 'short', 'detailed', 'noFollowUp', 'casual', 'formal'] as const;

interface Agent_Prompt_Styles_Props {
  text: string;
  disabled: boolean;
  onChange: (text: string) => void;
}

const Agent_Prompt_Styles = ({ text, disabled, onChange }: Agent_Prompt_Styles_Props) => {
  const { t } = useTranslation('assistant');

  const toggle = (instruction: string) => {
    const lines = text.split('\n').filter((line) => line.trim());
    const next = lines.includes(instruction)
      ? lines.filter((line) => line !== instruction)
      : [...lines, instruction];
    onChange(next.join('\n'));
  };

  return (
    <div className='Agent_Prompt_Styles'>
      <span className='Agent_Prompt_Editor_Label'>{t('prompts.styles.title')}</span>
      <div className='Agent_Prompt_Styles_Chips'>
        {STYLE_KEYS.map((key) => {
          const instruction = t(`prompts.styles.${key}.text`);
          const active = text.split('\n').includes(instruction);
          return (
            <button
              key={key}
              type='button'
              className={active ? 'active' : ''}
              disabled={disabled}
              title={instruction}
              onClick={() => toggle(instruction)}
            >
              {t(`prompts.styles.${key}.label`)}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Agent_Prompt_Styles;
