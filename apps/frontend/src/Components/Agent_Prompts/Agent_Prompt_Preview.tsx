import { useTranslation } from 'react-i18next';
import './Agent_Prompts.scss';
import { useStylePreview } from '../../Hooks/Agent/useStylePreview';

interface Agent_Prompt_Preview_Props {
  text: string;
}

const Agent_Prompt_Preview = ({ text }: Agent_Prompt_Preview_Props) => {
  const { t } = useTranslation('assistant');
  const { preview, loading, fetchPreview } = useStylePreview();

  return (
    <div className='Agent_Prompt_Preview'>
      <div className='Agent_Prompt_Preview_Head'>
        <div>
          <span className='Agent_Prompt_Editor_Label'>{t('prompts.preview.title')}</span>
          <p className='Agent_Prompts_Text'>{t('prompts.preview.description')}</p>
        </div>
        <button type='button' className='Agent_Prompt_Preview_Button' onClick={() => fetchPreview(text)} disabled={loading}>
          {loading ? t('prompts.preview.loading') : t('prompts.preview.run')}
        </button>
      </div>

      {preview && (
        <>
          <span className='Agent_Prompt_Preview_Question'>{t('prompts.preview.question', { question: preview.question })}</span>
          <div className='Agent_Prompt_Preview_Columns'>
            <div className='Agent_Prompt_Preview_Answer'>
              <span className='Agent_Prompt_Preview_Tag'>{t('prompts.preview.before')}</span>
              <p>{preview.before}</p>
            </div>
            <div className='Agent_Prompt_Preview_Answer after'>
              <span className='Agent_Prompt_Preview_Tag'>{t('prompts.preview.after')}</span>
              <p>{preview.after}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Agent_Prompt_Preview;
