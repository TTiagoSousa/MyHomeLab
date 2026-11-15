import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Close } from '../../../Imports/icons';

interface Doc_Tags_Input_Props {
  id: string;
  tags: string[];
  onChange: (tags: string[]) => void;
}

const Doc_Tags_Input = ({ id, tags, onChange }: Doc_Tags_Input_Props) => {
  const { t } = useTranslation('docs');
  const [text, setText] = useState('');

  const addTag = () => {
    const tag = text.trim().replace(/,$/, '').trim();
    setText('');
    if (!tag || tags.includes(tag)) return;
    onChange([...tags, tag]);
  };

  const removeTag = (tag: string) => onChange(tags.filter((item) => item !== tag));

  return (
    <div className='Doc_Tags_Input'>
      {tags.map((tag) => (
        <span key={tag} className='Doc_Tag'>
          {tag}
          <button type='button' onClick={() => removeTag(tag)} aria-label={t('form.removeTag', { tag })} title={t('form.removeTag', { tag })}>
            <Close />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={text}
        placeholder={tags.length ? '' : t('form.tagsPlaceholder')}
        onChange={(e) => setText(e.target.value)}
        onBlur={addTag}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag();
          }
          if (e.key === 'Backspace' && !text && tags.length) removeTag(tags[tags.length - 1]);
        }}
      />
    </div>
  );
};

export default Doc_Tags_Input;
