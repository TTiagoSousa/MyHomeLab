import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Editor } from '@tiptap/react';

interface Toolbar_Link_Field_Props {
  editor: Editor;
  onClose: () => void;
}

const Toolbar_Link_Field = ({ editor, onClose }: Toolbar_Link_Field_Props) => {
  const { t } = useTranslation('docs');
  const [url, setUrl] = useState<string>(editor.getAttributes('link').href ?? '');

  const apply = () => {
    const href = url.trim();
    const chain = editor.chain().focus().extendMarkRange('link');
    if (href) chain.setLink({ href }).run();
    else chain.unsetLink().run();
    onClose();
  };

  const remove = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    onClose();
  };

  return (
    <div className='Toolbar_Link_Field'>
      <input
        value={url}
        autoFocus
        placeholder={t('editor.link.placeholder')}
        aria-label={t('editor.link.label')}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            apply();
          }
          if (e.key === 'Escape') onClose();
        }}
      />
      <button type='button' className='primary' onClick={apply}>
        {t('editor.link.apply')}
      </button>
      {editor.isActive('link') && (
        <button type='button' onClick={remove}>
          {t('editor.link.remove')}
        </button>
      )}
    </div>
  );
};

export default Toolbar_Link_Field;
