/** "14:05", à hora de Lisboa (a dos comentários e das tarefas). */
export function lisbonTime(date: Date): string {
  return date.toLocaleTimeString('pt-PT', {
    timeZone: 'Europe/Lisbon',
    hour: '2-digit',
    minute: '2-digit',
  });
}
