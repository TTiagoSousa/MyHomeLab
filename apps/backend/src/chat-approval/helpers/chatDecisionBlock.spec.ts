import { chatDecisionBlock } from './chatDecisionBlock';

const proposal = { status: 'PENDING', conversationId: 'c1', turnId: 't1' };
const turn = { source: 'chat', depth: 0, conversationId: 'c1', turnId: 't2' };

describe('decidir uma proposta pelo chat', () => {
  it('aceita na conversa dela, numa volta seguinte, no agente de topo', () => {
    expect(chatDecisionBlock(proposal, turn)).toBeNull();
  });

  it('recusa num disparo', () => {
    expect(
      chatDecisionBlock(proposal, { ...turn, source: 'schedule' }),
    ).toMatch(/Recusado/);
  });

  it('recusa num subagente', () => {
    expect(chatDecisionBlock(proposal, { ...turn, depth: 1 })).toMatch(
      /Recusado/,
    );
  });

  it('recusa na mesma volta em que foi feita', () => {
    expect(chatDecisionBlock(proposal, { ...turn, turnId: 't1' })).toMatch(
      /mesma resposta/,
    );
  });

  it('recusa uma proposta de outra conversa ou sem conversa', () => {
    expect(
      chatDecisionBlock(proposal, { ...turn, conversationId: 'c2' }),
    ).toMatch(/nesta conversa/);
    expect(
      chatDecisionBlock({ ...proposal, conversationId: null }, turn),
    ).toMatch(/nesta conversa/);
  });

  it('recusa uma proposta já decidida', () => {
    expect(
      chatDecisionBlock({ ...proposal, status: 'APPROVED' }, turn),
    ).toMatch(/já foi decidida/);
  });
});
