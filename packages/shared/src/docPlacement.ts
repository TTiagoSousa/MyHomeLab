/**
 * Onde um documento aparece em Documentos quando não está numa secção do utilizador.
 * A página e os agentes usam esta mesma regra, para os agentes verem o que ele vê.
 */
export const DOC_PROCESS_TAG = 'processo';

/** As ligações que levam um documento para "Servidores e apps". */
export const DOC_THING_LINK_TYPES = ['SERVER', 'GUEST', 'APP', 'MONITOR'] as const;

export type DocAutoGroup = 'things' | 'projects' | 'general';

export interface DocPlacementInput {
  tags: string[];
  links: { type: string }[];
}

/**
 * - `general` ("Gerais"): os de processo (etiqueta `processo`, mesmo ligados) e os que não
 *   estão ligados a um servidor, máquina, app, monitor ou projeto;
 * - `things` ("Servidores e apps"): ligados a um servidor, máquina, app ou monitor;
 * - `projects` ("Projetos"): ligados a um projeto (e a nenhuma das coisas acima).
 */
export function docAutoGroup(doc: DocPlacementInput): DocAutoGroup {
  if (doc.tags.includes(DOC_PROCESS_TAG)) return 'general';
  const types = doc.links.map((link) => link.type);
  if (types.some((type) => (DOC_THING_LINK_TYPES as readonly string[]).includes(type))) return 'things';
  if (types.includes('PROJECT')) return 'projects';
  return 'general';
}
