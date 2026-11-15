import { CheckResult } from './checkTarget';

/**
 * O título e a descrição da tarefa de uma falha. Só factos (o que se testou, o erro,
 * quando); o que fazer com ela está no documento "Serviço em baixo – como se trata".
 */
export function downTaskText(
  monitor: {
    name: string;
    kind: string;
    target: string;
    guestVmid: number | null;
    guestName: string | null;
  },
  result: CheckResult,
  serverName: string | null,
  at: Date,
): { title: string; description: string } {
  const when = at.toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' });
  const machine =
    monitor.guestVmid != null
      ? `${monitor.guestName ?? 'CT/VM'} (ID ${monitor.guestVmid})`
      : 'sem máquina associada';
  return {
    title: `Serviço ${monitor.name} falhou`,
    description: [
      `O ping ao serviço **${monitor.name}** falhou (duas tentativas, com 10 s de intervalo).`,
      '',
      `- Endereço: ${monitor.target} (${monitor.kind})`,
      `- Erro: ${result.error ?? 'sem resposta'}`,
      `- Hora: ${when}`,
      `- Latência: ${result.latencyMs != null ? `${result.latencyMs} ms` : 'sem resposta'}`,
      `- Servidor: ${serverName ?? 'sem servidor'} · máquina: ${machine}`,
    ].join('\n'),
  };
}
