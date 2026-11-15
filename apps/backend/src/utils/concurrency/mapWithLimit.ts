/**
 * Como o Promise.all, mas com um tecto de tarefas em curso.
 *
 * APIs com quota por segundo — o Gmail, por exemplo — devolvem 429 quando se
 * dispara uma rajada de pedidos de uma só vez. A ordem dos resultados é a mesma
 * da entrada, tal como no Promise.all.
 */
export async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      for (;;) {
        const index = next++;
        if (index >= items.length) return;
        results[index] = await fn(items[index]);
      }
    },
  );

  await Promise.all(workers);
  return results;
}
