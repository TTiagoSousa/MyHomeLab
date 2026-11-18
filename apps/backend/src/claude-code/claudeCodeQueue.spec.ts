import { inTurn, turnState } from './claudeCodeQueue';

const later = () => {
  let release!: () => void;
  const done = new Promise<void>((resolve) => (release = resolve));
  return { done, release };
};

describe('inTurn', () => {
  it('corre no máximo `max` ao mesmo tempo e passa a vez pela ordem de chegada', async () => {
    const order: string[] = [];
    const a = later();
    const b = later();
    const first = inTurn('u1', 2, async () => {
      order.push('a');
      await a.done;
    });
    const second = inTurn('u1', 2, async () => {
      order.push('b');
      await b.done;
    });
    const third = inTurn('u1', 2, () => {
      order.push('c');
      return Promise.resolve();
    });
    await Promise.resolve();
    expect(order).toEqual(['a', 'b']);
    expect(turnState('u1')).toEqual({ running: 2, waiting: 1 });
    a.release();
    await first;
    await third;
    expect(order).toEqual(['a', 'b', 'c']);
    b.release();
    await second;
    expect(turnState('u1')).toEqual({ running: 0, waiting: 0 });
  });

  it('larga a vez quando o trabalho falha', async () => {
    await expect(
      inTurn('u2', 1, () => Promise.reject(new Error('falhou'))),
    ).rejects.toThrow('falhou');
    await expect(inTurn('u2', 1, () => Promise.resolve(7))).resolves.toBe(7);
    expect(turnState('u2')).toEqual({ running: 0, waiting: 0 });
  });

  it('cada utilizador tem a sua fila', async () => {
    const hold = later();
    const busy = inTurn('u3', 1, () => hold.done);
    await expect(inTurn('u4', 1, () => Promise.resolve('ok'))).resolves.toBe(
      'ok',
    );
    hold.release();
    await busy;
  });
});
