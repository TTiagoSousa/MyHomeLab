import { AgentTool } from '../claude-agent.client';
import { AgentContext } from '../agents/agent-context';
import { studyAction } from 'src/disk-alert/disk-alert.service';

const ALERT = {
  type: 'string' as const,
  description:
    'O id do aviso de disco (vem no pedido e na descrição da tarefa).',
};

const safely =
  <T>(work: (input: T) => Promise<string>) =>
  async (input: T) => {
    try {
      return await work(input);
    } catch (error) {
      return `Não deu: ${error instanceof Error ? error.message : String(error)}`;
    }
  };

/**
 * Os avisos de disco quase cheio (cron job do servidor). O caminho e os travões são do
 * MyHomeLab (DiskAlertService): o agente lê, grava o estudo, aumenta ou pergunta, e cada
 * ferramenta diz-lhe se pode avançar.
 */
export function buildDiskAlertTools(context: AgentContext): AgentTool[] {
  const alerts = context.diskAlerts;
  return [
    {
      name: 'disk_alert_get',
      description:
        'Um aviso de disco quase cheio: a máquina, o disco, a medição, o limite, o storage, o que podes fazer sem perguntar, o estudo e a pergunta em aberto.',
      inputSchema: {
        type: 'object',
        properties: { alert: ALERT },
        required: ['alert'],
      },
      handler: safely((input: { alert: string }) =>
        alerts.describe(context.userId, input.alert),
      ),
    },
    {
      name: 'disk_alert_save_study',
      description:
        'Grava o diagnóstico (o que ocupa o espaço) e o plano, com a ação: cleanup (limpar o que é seguro), grow (aumentar, com grow_gb) ou ask (precisas dele, com question). O MyHomeLab responde se podes avançar ou se a tarefa fica à espera dele.',
      inputSchema: {
        type: 'object',
        properties: {
          alert: ALERT,
          diagnosis: {
            type: 'string',
            description: 'O que ocupa o espaço, com os números.',
          },
          plan: {
            type: 'string',
            description: 'O que vais fazer e quanto liberta ou acrescenta.',
          },
          action: { type: 'string', enum: ['cleanup', 'grow', 'ask'] },
          grow_gb: {
            type: 'number',
            description: 'Com grow: quantos GB acrescentar.',
          },
          question: {
            type: 'string',
            description: 'Com ask: a pergunta para ele.',
          },
        },
        required: ['alert', 'diagnosis', 'plan', 'action'],
      },
      handler: safely(
        (input: {
          alert: string;
          diagnosis: string;
          plan: string;
          action: string;
          grow_gb?: number;
          question?: string;
        }) => {
          return alerts.saveStudy(context.userId, input.alert, {
            diagnosis: input.diagnosis,
            plan: input.plan,
            action: studyAction(input.action),
            growGb: input.grow_gb,
            question: input.question,
          });
        },
      ),
    },
    {
      name: 'disk_alert_grow',
      description:
        'Aumenta o disco do aviso (só depois de o disk_alert_save_study dizer que podes, ou de ele aprovar). Num CT é o rootfs; numa VM diz o disco virtual (disk, ex.: scsi0) e depois alarga a partição por SSH. O MyHomeLab recusa o que passar dos limites.',
      inputSchema: {
        type: 'object',
        properties: {
          alert: ALERT,
          gb: { type: 'number', description: 'Quantos GB acrescentar.' },
          disk: {
            type: 'string',
            description: 'Numa VM: o disco virtual (scsi0, virtio0…).',
          },
        },
        required: ['alert', 'gb'],
      },
      handler: safely((input: { alert: string; gb: number; disk?: string }) =>
        alerts.grow(context.userId, input.alert, input.gb, input.disk),
      ),
    },
    {
      name: 'disk_alert_ask',
      description:
        'Pergunta-lhe algo sobre o aviso: a tarefa passa para Waiting for reply e a pergunta fica nela e nas Tarefas. Depois pára: quando ele responder és chamado outra vez.',
      inputSchema: {
        type: 'object',
        properties: { alert: ALERT, question: { type: 'string' } },
        required: ['alert', 'question'],
      },
      handler: safely((input: { alert: string; question: string }) =>
        alerts.askUser(context.userId, input.alert, input.question),
      ),
    },
    {
      name: 'disk_alert_done',
      description:
        'Acabaste de corrigir: escreve o que fizeste e quanto libertaste. O MyHomeLab volta a medir e fecha a tarefa, ou pergunta-lhe o que fazer se continuar acima do limite.',
      inputSchema: {
        type: 'object',
        properties: { alert: ALERT, summary: { type: 'string' } },
        required: ['alert', 'summary'],
      },
      handler: safely((input: { alert: string; summary: string }) =>
        alerts.done(context.userId, input.alert, input.summary),
      ),
    },
  ];
}
