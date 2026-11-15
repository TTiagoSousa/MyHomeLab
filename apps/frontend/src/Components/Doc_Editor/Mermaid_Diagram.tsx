import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { renderMermaid } from './renderMermaid';
import { useBodyTheme } from './useBodyTheme';

interface Mermaid_Diagram_Props {
  code: string;
  delay: number;
}

const Mermaid_Diagram = ({ code, delay }: Mermaid_Diagram_Props) => {
  const { t } = useTranslation('docs');
  const theme = useBodyTheme();
  const [svg, setSvg] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!code.trim()) return;
    const timer = setTimeout(async () => {
      try {
        setSvg(await renderMermaid(code, theme));
        setFailed(false);
      } catch {
        setFailed(true);
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [code, theme, delay]);

  if (!code.trim()) return <div className='Mermaid_Diagram empty'>{t('editor.diagram.empty')}</div>;

  return (
    <div className={`Mermaid_Diagram${failed ? ' failed' : ''}`}>
      {svg ? (
        <div className='Mermaid_Diagram_Svg' dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        !failed && <span className='Mermaid_Diagram_Loading'>{t('editor.diagram.loading')}</span>
      )}
      {failed && <span className='Mermaid_Diagram_Error'>{t('editor.diagram.error')}</span>}
    </div>
  );
};

export default Mermaid_Diagram;
