import { stripActionsNote } from './assistant.service';

describe('stripActionsNote', () => {
  it('tira a nota do histórico que o modelo copiou para o fim da resposta', () => {
    expect(
      stripActionsNote(
        'Feito.\n\n[Para esta resposta a equipa fez: Jarvis: a pedir trabalho a Personal Trainer]',
      ),
    ).toBe('Feito.');
    expect(
      stripActionsNote(
        'Feito.\n\n[Nota interna do histórico, nunca a escrevas numa resposta — a equipa fez: X]',
      ),
    ).toBe('Feito.');
  });

  it('não mexe em parênteses retos normais', () => {
    expect(stripActionsNote('Ver [o documento] antes.')).toBe(
      'Ver [o documento] antes.',
    );
  });
});
