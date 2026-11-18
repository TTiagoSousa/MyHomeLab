/** A próxima vez de uma tarefa: daqui a `intervalMinutes` (desligada → nunca). */
export function nextRunAt(intervalMinutes: number, from = new Date()) {
  return intervalMinutes > 0
    ? new Date(from.getTime() + intervalMinutes * 60_000)
    : null;
}
