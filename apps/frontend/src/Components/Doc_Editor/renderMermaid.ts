import type { BodyTheme } from './useBodyTheme';

let renderCount = 0;

export const renderMermaid = async (code: string, theme: BodyTheme): Promise<string> => {
  const { default: mermaid } = await import('mermaid');
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    suppressErrorRendering: true,
    theme: theme === 'dark' ? 'dark' : 'default',
    fontFamily: 'Barlow, system-ui, sans-serif',
  });

  renderCount += 1;
  const id = `doc-mermaid-${renderCount}`;
  try {
    const { svg } = await mermaid.render(id, code);
    return svg;
  } finally {
    document.getElementById(id)?.remove();
    document.getElementById(`d${id}`)?.remove();
  }
};
