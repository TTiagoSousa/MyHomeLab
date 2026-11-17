import { docAutoGroup } from '@myhomelab/shared';
import { DocLinkType } from 'src/generated/prisma/client/client';
import { mergeLinks, proposalChanges } from './proposalOrganize';

const trek = { type: DocLinkType.APP, targetId: 'app-trek', label: 'TREK' };
const agent = {
  type: DocLinkType.AGENT,
  targetId: 'travel',
  label: 'Agente de viagens',
};

describe('arrumação das propostas', () => {
  it('diz onde um documento aparece fora das secções', () => {
    expect(docAutoGroup({ tags: [], links: [agent] })).toBe('general');
    expect(docAutoGroup({ tags: [], links: [agent, trek] })).toBe('things');
    expect(docAutoGroup({ tags: ['processo'], links: [trek] })).toBe('general');
    expect(docAutoGroup({ tags: [], links: [{ type: 'PROJECT' }] })).toBe(
      'projects',
    );
  });

  it('acrescenta e tira ligações sem perder as que já tinha', () => {
    expect(mergeLinks([agent], [trek, trek])).toEqual([agent, trek]);
    expect(mergeLinks([agent, trek], [], ['app-trek'])).toEqual([agent]);
  });

  it('mostra o que muda: título, etiquetas, ligações e secção', () => {
    const changes = proposalChanges(
      {
        title: 'AdGuard – dia a dia',
        tags: ['adguard', 'servidor'],
        links: [agent, trek],
        section: { name: 'Viagens' },
      },
      {
        title: 'AdGuard – DNS',
        tags: ['adguard', 'dns'],
        links: [agent],
        sectionId: null,
      },
      () => null,
    );
    expect(changes.title).toEqual({
      from: 'AdGuard – DNS',
      to: 'AdGuard – dia a dia',
    });
    expect(changes.tagsAdded).toEqual(['servidor']);
    expect(changes.tagsRemoved).toEqual(['dns']);
    expect(changes.linksAdded).toEqual([
      { type: DocLinkType.APP, label: 'TREK' },
    ]);
    expect(changes.linksRemoved).toEqual([]);
    expect(changes.section).toEqual({ from: null, to: 'Viagens', isNew: true });
  });
});
