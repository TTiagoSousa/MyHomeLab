import { createForgejoClient } from 'src/forgejo/forgejo.client';

const TASK = 'delete_repo_archives';
const WAIT_MS = 60_000;
const POLL_MS = 2_000;

/**
 * Limpa a cache dos arquivos do Forgejo (repo-archive) pelo cron dele, que apaga os
 * ficheiros e os registos na base de dados. Apagar só os ficheiros (à mão) deixa os
 * registos: o Forgejo julga que o arquivo existe e o bundle seguinte falha.
 *
 * O cron corre em segundo plano: espera até ele contar mais uma execução (no máximo
 * 1 minuto). Precisa de uma conta admin; se falhar, não estraga nada (é só cache).
 */
export async function clearForgejoArchives(
  client: ReturnType<typeof createForgejoClient>,
): Promise<void> {
  const runs = async () =>
    (await client.cronTasks()).find((task) => task.name === TASK)?.exec_times ??
    0;
  try {
    const before = await runs();
    await client.deleteRepoArchives();
    const deadline = Date.now() + WAIT_MS;
    while (Date.now() < deadline && (await runs()) <= before) {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
  } catch {
    return;
  }
}
