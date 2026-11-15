/**
 * Um ponto como vem das regras — "🤖 Backup recente — prova: a data do último (Regras gerais)"
 * — partido em quem o confirma, o ponto, a prova que serve e o documento de onde vem.
 */
export function parsePoint(text: string): {
  who: 'agent' | 'user';
  point: string;
  proof: string | null;
  source: string | null;
} {
  let rest = text.trim();
  let source: string | null = null;
  const fromDoc = /\s+\(([^()]+)\)$/.exec(rest);
  if (fromDoc) {
    source = fromDoc[1].trim();
    rest = rest.slice(0, fromDoc.index).trim();
  }
  const who = rest.startsWith('👤') ? 'user' : 'agent';
  rest = rest.replace(/^(🤖|👤)\s*/u, '');
  const [point, proof] = rest.split(/\s+[—-]\s+prova:\s*/i);
  return { who, point: point.trim(), proof: proof?.trim() || null, source };
}
