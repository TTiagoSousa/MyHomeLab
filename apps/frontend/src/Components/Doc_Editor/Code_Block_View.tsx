import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import Mermaid_Diagram from './Mermaid_Diagram';
import './Code_Block_View.scss';

const MERMAID_LANGUAGE = 'mermaid';

const Code_Block_View = ({ node, editor, updateAttributes }: ReactNodeViewProps) => {
  const { t } = useTranslation('docs');
  const [showCode, setShowCode] = useState(false);
  const language: string = node.attrs.language ?? '';
  const isMermaid = language.trim().toLowerCase() === MERMAID_LANGUAGE;
  const editable = editor.isEditable;
  const codeHidden = isMermaid && !editable && !showCode;

  return (
    <NodeViewWrapper className={`Code_Block${isMermaid ? ' mermaid' : ''}${editable ? ' editable' : ''}`}>
      <div className='Code_Block_Head' contentEditable={false}>
        {editable ? (
          <input
            className='Code_Block_Language'
            value={language}
            placeholder={t('editor.code.language')}
            aria-label={t('editor.code.language')}
            onChange={(e) => updateAttributes({ language: e.target.value || null })}
          />
        ) : (
          <span className='Code_Block_Label'>{isMermaid ? t('editor.diagram.label') : language}</span>
        )}
        {isMermaid && !editable && (
          <button type='button' className='Code_Block_Toggle' onClick={() => setShowCode(!showCode)}>
            {showCode ? t('editor.diagram.hideCode') : t('editor.diagram.showCode')}
          </button>
        )}
      </div>

      {isMermaid && !editable && (
        <div contentEditable={false}>
          <Mermaid_Diagram code={node.textContent} delay={0} />
        </div>
      )}

      <pre className={codeHidden ? 'hidden' : ''}>
        <NodeViewContent<'code'> as='code' />
      </pre>

      {isMermaid && editable && (
        <div className='Code_Block_Preview' contentEditable={false}>
          <span className='Code_Block_Preview_Label'>{t('editor.diagram.preview')}</span>
          <Mermaid_Diagram code={node.textContent} delay={400} />
        </div>
      )}
    </NodeViewWrapper>
  );
};

export default Code_Block_View;
